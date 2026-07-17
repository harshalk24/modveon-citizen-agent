// Session store — Redis (Upstash) in production, in-memory Map fallback for
// local dev when REDIS_URL/REDIS_TOKEN aren't set. The Map broke across
// Vercel serverless instances: each instance held its own Map, so a session
// (and the 30/min rate limit) was really N separate stores, one per
// instance — this file's own original comment ("swap for Redis when
// available") flagged exactly this gap.
//
// automaticDeserialization is disabled so .get() always returns the raw
// string we stored — manual JSON.stringify/JSON.parse throughout, no
// implicit magic to reason about (confirmed via the installed SDK's source:
// defaultSerializer passes strings through unchanged on .set(), so
// JSON.stringify(data) round-trips byte-for-byte; INCR/EXPIRE return plain
// numbers regardless of this setting).
import { Redis } from "@upstash/redis"

interface SessionData {
  messages: unknown[]
  turnCount: number
  citizenId?: string
  // Task History-C1: the active durable Conversation (Postgres) this live
  // session is writing through to. Optional/backward-compatible — absent
  // means no active conversation yet (lazy-created on first turn) or it was
  // cleared by "new conversation." Distinct store, distinct lifecycle: this
  // field expiring with the 24h session TTL does NOT delete the
  // Conversation/Message rows themselves.
  conversationId?: string
}

const SESSION_TTL_SECONDS = 24 * 60 * 60
const SUMMARY_TRIGGER = 6
const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX = 30

// A single conditional at module load — local dev without Redis env vars
// keeps working unchanged (in-memory Map); when Redis env vars are set
// (prod), Redis is used instead. Matches this file's own original comment
// ("optional for dev, required for production").
//
// Accepts both UPSTASH_REDIS_REST_URL/TOKEN (Upstash's own standard names —
// what Vercel's Upstash marketplace integration sets automatically) and the
// custom REDIS_URL/REDIS_TOKEN this file originally documented, preferring
// the standard names.
const redisUrl   = process.env.UPSTASH_REDIS_REST_URL   || process.env.REDIS_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN
const redis = (redisUrl && redisToken)
  ? new Redis({ url: redisUrl, token: redisToken, automaticDeserialization: false })
  : null

// In-memory fallback stores — used in dev (no Redis env) AND as the graceful
// fallback when a configured Redis is unreachable (see redisSafe below).
const store = new Map<string, SessionData>()
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Fail-soft guard: a configured-but-broken Redis (dead/paused Upstash instance,
// rotated token, wrong URL) must NOT take down the chat endpoint. These stores
// are the first calls in POST /api/chat, BEFORE its try/catch — an unhandled
// throw here returns an empty-body 500 for the whole conversation. So every
// Redis call is wrapped: on error we log once and fall back to in-memory
// (rate-limit/session become best-effort per-instance, which is acceptable —
// a degraded limiter beats a dead assistant). Removing the Redis env vars is
// still the real fix; this just makes the outage non-fatal.
let redisWarned = false
async function redisSafe<T>(op: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!redis) return fallback
  try {
    return await fn()
  } catch (e) {
    if (!redisWarned) {
      redisWarned = true
      console.error(`[session] Redis ${op} failed — falling back to in-memory. Check REDIS_URL/REDIS_TOKEN (or remove them to use in-memory).`, e instanceof Error ? e.message : e)
    }
    return fallback
  }
}

function sessionKey(sessionId: string) {
  return `session:${sessionId}`
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  if (redis) {
    const hit = await redisSafe("getSession", async () => {
      const raw = await redis!.get<string>(sessionKey(sessionId))
      return { ok: true as const, value: raw ? JSON.parse(raw) as SessionData : null }
    }, null)
    if (hit) return hit.value
    // Redis errored → fall through to in-memory.
  }
  return store.get(sessionId) ?? null
}

export async function saveSession(sessionId: string, data: SessionData) {
  if (redis) {
    // Native Redis expiry — replaces the old setTimeout-based cleanup, which
    // never survived a serverless instance recycling (the timer died with
    // the instance, so nothing actually expired in production).
    const ok = await redisSafe("saveSession", async () => {
      await redis!.set(sessionKey(sessionId), JSON.stringify(data), { ex: SESSION_TTL_SECONDS })
      return true
    }, false)
    if (ok) return
    // Redis errored → also write in-memory so the session survives this instance.
  }
  store.set(sessionId, data)
}

export async function incrementTurn(sessionId: string): Promise<number> {
  const session = await getSession(sessionId)
  const newCount = (session?.turnCount || 0) + 1
  if (session) {
    await saveSession(sessionId, { ...session, turnCount: newCount })
  } else {
    await saveSession(sessionId, { messages: [], turnCount: newCount })
  }
  return newCount
}

export function shouldSummarise(turnCount: number): boolean {
  return turnCount > 0 && turnCount % SUMMARY_TRIGGER === 0
}

export function getRecentMessages(messages: unknown[], n = 4): unknown[] {
  return messages.slice(-n)
}

export async function checkRateLimit(sessionId: string): Promise<boolean> {
  if (redis) {
    // INCR + EXPIRE replicates the existing fixed-window logic (30/min) but
    // shared across every instance, instead of 30/min PER instance.
    const result = await redisSafe("checkRateLimit", async () => {
      const key = `ratelimit:${sessionId}`
      const count = await redis!.incr(key)
      if (count === 1) await redis!.expire(key, RATE_LIMIT_WINDOW_SECONDS)
      return { ok: true as const, allowed: count <= RATE_LIMIT_MAX }
    }, null)
    if (result) return result.allowed
    // Redis errored → fall through to the in-memory limiter below (best-effort).
  }

  const now = Date.now()
  const entry = rateLimitStore.get(sessionId)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(sessionId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 })
    return true
  }
  entry.count += 1
  return entry.count <= RATE_LIMIT_MAX
}
