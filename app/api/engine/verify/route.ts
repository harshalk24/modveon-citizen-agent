import { NextRequest, NextResponse } from "next/server"
import { runWeeklyVerification } from "@/lib/engine/orchestrator"

// GET /api/engine/verify
// Weekly Vercel cron target — checks all live scheme links.
// Schedule: every Monday at 06:00 UTC  →  "0 6 * * 1"
// Also callable manually via GET with x-engine-secret header.

export async function GET(req: NextRequest) {
  // Vercel cron passes Authorization: Bearer <CRON_SECRET>
  // Manual calls use x-engine-secret header
  const authHeader = req.headers.get("authorization")
  const cronSecret = authHeader?.replace("Bearer ", "")
  const manualSecret = req.headers.get("x-engine-secret")

  const isAuthorized =
    cronSecret === process.env.CRON_SECRET ||
    manualSecret === process.env.ENGINE_SECRET

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const country = searchParams.get("country") ?? "SV"

  try {
    const result = await runWeeklyVerification(country)
    return NextResponse.json({
      status: "complete",
      country,
      runAt: new Date().toISOString(),
      ...result,
    })
  } catch (err) {
    console.error("[Engine] Weekly verification error:", err)
    return NextResponse.json(
      { error: "Verification failed", detail: String(err) },
      { status: 500 }
    )
  }
}
