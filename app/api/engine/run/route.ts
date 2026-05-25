import { NextRequest, NextResponse } from "next/server"
import { runFullCrawl } from "@/lib/engine/orchestrator"

// POST /api/engine/run
// Triggers a full crawl + extraction + verification pass.
// Protected by ENGINE_SECRET header to prevent unauthorised runs.
// NOTE: This will time out on Vercel's 10s limit for hobby plans.
// On Pro (60s limit) or via a dedicated background job runner
// (e.g. Inngest, QStash, Trigger.dev) this runs without issue.

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-engine-secret")
  if (secret !== process.env.ENGINE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { country?: string }
  const country = body.country ?? "SV"

  try {
    // Fire and forget — return 202 immediately so the request doesn't time out.
    // The crawl continues in the background (works on Node.js runtimes).
    const resultPromise = runFullCrawl(country)

    // Give the client immediate acknowledgement
    const response = NextResponse.json(
      { status: "started", country, startedAt: new Date().toISOString() },
      { status: 202 }
    )

    // Await only in environments that support long-running requests
    if (process.env.WAIT_FOR_CRAWL === "true") {
      const result = await resultPromise
      return NextResponse.json({ status: "complete", country, ...result })
    }

    // Log result when it eventually resolves (background)
    resultPromise
      .then((r) =>
        console.log(
          `[Engine] Crawl complete for ${country}:`,
          JSON.stringify(r)
        )
      )
      .catch((e) => console.error("[Engine] Crawl error:", e))

    return response
  } catch (err) {
    console.error("[Engine] Run error:", err)
    return NextResponse.json(
      { error: "Engine run failed", detail: String(err) },
      { status: 500 }
    )
  }
}
