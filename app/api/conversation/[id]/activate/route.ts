import { NextResponse } from "next/server"
import { conversationExists } from "@/lib/conversation-store"
import { getSession, saveSession } from "@/lib/session"

// Task History-C2 — sets the live Redis session's active conversationId to a
// SPECIFIC, already-existing conversation. This is the continue-style crux:
// without it, sending a message after loading a past conversation would
// lazily create a NEW conversation (commit 1's behavior for "no active id"),
// not append to the one just opened.
//
// Ownership is verified FIRST (conversationExists) — app/api/chat/route.ts's
// write-through trusts whatever conversationId sits in the session without
// re-checking per turn, so this is the one place that gate has to hold.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const citizenId = req.headers.get("x-citizen-id")
  if (!citizenId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 })

  const owns = await conversationExists(params.id, citizenId)
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const session = await getSession(sessionId)
  await saveSession(sessionId, { ...(session ?? { messages: [], turnCount: 0 }), conversationId: params.id })

  return NextResponse.json({ ok: true })
}
