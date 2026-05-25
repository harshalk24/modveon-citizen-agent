import { NextRequest, NextResponse } from "next/server"
import { approveScheme, rejectScheme } from "@/lib/engine/db"

// POST /api/engine/approve
// Body: { reviewId: string, action: "approve" | "reject", reason?: string }

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-engine-secret")
  if (secret !== process.env.ENGINE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    reviewId?: string
    action?: "approve" | "reject"
    reason?: string
  }

  if (!body.reviewId || !body.action) {
    return NextResponse.json(
      { error: "reviewId and action are required" },
      { status: 400 }
    )
  }

  if (body.action === "approve") {
    const result = await approveScheme(body.reviewId)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    return NextResponse.json({ success: true, action: "approve" })
  }

  if (body.action === "reject") {
    if (!body.reason) {
      return NextResponse.json(
        { error: "reason is required for rejection" },
        { status: 400 }
      )
    }
    await rejectScheme(body.reviewId, body.reason)
    return NextResponse.json({ success: true, action: "reject" })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
