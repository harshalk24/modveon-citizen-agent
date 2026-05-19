// In-memory session store — works for single-server dev/demo.
// Swap the store functions below for Redis when a compatible
// Upstash endpoint is available.

interface SessionData {
  messages: unknown[]
  turnCount: number
  citizenId?: string
}

const store = new Map<string, SessionData>()
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const SESSION_TTL_MS  = 24 * 60 * 60 * 1000
const SUMMARY_TRIGGER = 6

export async function getSession(sessionId: string): Promise<SessionData | null> {
  return store.get(sessionId) ?? null
}

export async function saveSession(sessionId: string, data: SessionData) {
  store.set(sessionId, data)
  // Simple TTL cleanup
  setTimeout(() => store.delete(sessionId), SESSION_TTL_MS)
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
  const now = Date.now()
  const entry = rateLimitStore.get(sessionId)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(sessionId, { count: 1, resetAt: now + 60_000 })
    return true
  }

  entry.count += 1
  return entry.count <= 30
}
