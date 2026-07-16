import { NextResponse } from "next/server"
import { upgradeTitleIfNeeded } from "@/lib/conversation-store"

// Task TITLE_OFF_HOTPATH — the title upgrade as its own self-contained
// request, triggered by the client AFTER the chat reply has already
// rendered (see app/api/chat/route.ts's X-Should-Upgrade-Title /
// X-Conversation-Id response headers). This is what takes the ~2.6s cheap-
// tier LLM call off the chat hot path WITHOUT becoming a dangling fire-and-
// forget promise: this request has its own independent lifecycle and runs
// to completion regardless of the chat function that triggered it.
//
// Idempotent (upgradeTitleIfNeeded no-ops once titleUpgraded is already
// true) and ownership-scoped (same x-citizen-id convention as every other
// conversation endpoint) — safe to call more than once.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const citizenId = req.headers.get("x-citizen-id")
  if (!citizenId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await upgradeTitleIfNeeded(params.id, citizenId)
  if (result === null) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(result)
}
