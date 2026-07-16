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

// Dev-only fallback stores — untouched by the Redis path.
const store = new Map<string, SessionData>()
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function sessionKey(sessionId: string) {
  return `session:${sessionId}`
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  if (redis) {
    const raw = await redis.get<string>(sessionKey(sessionId))
    return raw ? JSON.parse(raw) : null
  }
  return store.get(sessionId) ?? null
}

export async function saveSession(sessionId: string, data: SessionData) {
  if (redis) {
    // Native Redis expiry — replaces the old setTimeout-based cleanup, which
    // never survived a serverless instance recycling (the timer died with
    // the instance, so nothing actually expired in production).
    await redis.set(sessionKey(sessionId), JSON.stringify(data), { ex: SESSION_TTL_SECONDS })
    return
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
    const key = `ratelimit:${sessionId}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS)
    return count <= RATE_LIMIT_MAX
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
