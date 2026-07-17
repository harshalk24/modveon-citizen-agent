import { NextResponse } from "next/server"
import { getConversationMessages, deleteConversation } from "@/lib/conversation-store"

// Task History-C1 — fetch one conversation's messages in order (Behavior 6),
// for the sidebar (commit 2). Scoped to citizenId: getConversationMessages
// returns null (not an empty array) for a conversation that doesn't exist OR
// isn't owned by this citizen — both cases 404 identically, so this can't be
// used to probe which conversation ids exist for someone else.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const citizenId = req.headers.get("x-citizen-id")
  if (!citizenId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await getConversationMessages(params.id, citizenId)
  if (result === null) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(result)
}

// Delete affordance (Behavior 5) — hard delete, scoped to citizenId (can
// only delete your own). Cascades to the conversation's Messages via the
// schema's onDelete: Cascade FK.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const citizenId = req.headers.get("x-citizen-id")
  if (!citizenId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const deleted = await deleteConversation(params.id, citizenId)
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
