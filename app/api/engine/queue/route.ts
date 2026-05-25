import { NextRequest, NextResponse } from "next/server"
import { supabase, getQueueStats } from "@/lib/engine/db"

// GET /api/engine/queue?status=pending&limit=50&offset=0
// Returns items in the review queue for the admin UI.

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-engine-secret")
  if (secret !== process.env.ENGINE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? "pending"
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)
  const offset = parseInt(searchParams.get("offset") ?? "0")

  const [statsResult, itemsResult] = await Promise.all([
    getQueueStats(),
    supabase
      .from("review_queue")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
  ])

  if (itemsResult.error) {
    return NextResponse.json(
      { error: "Failed to fetch queue", detail: itemsResult.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    stats: statsResult,
    items: itemsResult.data ?? [],
    total: itemsResult.count ?? 0,
  })
}
