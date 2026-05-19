import { NextResponse } from "next/server"
import { getUnresolvedFeedback, resolveFeedback } from "@/lib/feedback"

export async function GET() {
  const feedbacks = await getUnresolvedFeedback()
  return NextResponse.json({ feedbacks })
}

export async function PATCH(req: Request) {
  const { id } = await req.json()
  await resolveFeedback(id)
  return NextResponse.json({ ok: true })
}
