import { NextResponse } from "next/server"
import { listConversations } from "@/lib/conversation-store"

// Task History-C1 — list query (Behavior 6), for the sidebar (commit 2).
// Same auth-lite convention as app/api/citizen/me: citizenId from the
// x-citizen-id header, not a query param.
export async function GET(req: Request) {
  const citizenId = req.headers.get("x-citizen-id")
  if (!citizenId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const conversations = await listConversations(citizenId)
  return NextResponse.json({ conversations })
}
