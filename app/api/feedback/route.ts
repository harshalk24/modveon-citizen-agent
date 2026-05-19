import { NextResponse } from "next/server"
import { saveFeedback } from "@/lib/feedback"

export async function POST(req: Request) {
  const { citizenId, serviceId, messageId, type, note } = await req.json()

  if (!type) return NextResponse.json({ error: "type required" }, { status: 400 })

  const fb = await saveFeedback({ citizenId, serviceId, messageId, type, note })
  return NextResponse.json({ ok: true, id: fb.id })
}
