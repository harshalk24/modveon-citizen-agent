import { NextResponse } from "next/server"
import { getSession, saveSession } from "@/lib/session"

// Task History-C1 — "new conversation" (Behavior 4): clears the live
// session's active conversationId so the NEXT chat turn lazily creates a
// fresh Conversation row. The old conversation is untouched in Postgres —
// this only affects what the Redis session points at.
export async function POST(req: Request) {
  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 })

  const session = await getSession(sessionId)
  if (session) {
    const { conversationId, ...rest } = session
    await saveSession(sessionId, rest)
  }

  return NextResponse.json({ ok: true })
}
