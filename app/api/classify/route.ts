import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { classifyQuery } from "@/lib/classify-query"
import { loadActiveSituationRows, resolveSituations } from "@/lib/situation-store"

// Task VERIFY_COPY (issue #1, Path A′) — a fast, READ-ONLY classify pre-flight.
//
// /api/chat computes the classification internally but can't flush it (or the
// X-UI-State header) until the reply is generated + grounded, so the client's
// verifying spinner can't branch on query type from it. Rather than restructure
// that safety-critical hot path, this thin endpoint runs ONLY the classifier
// and hands the type back so the client can pick neutral vs "official sources"
// copy while /api/chat runs in parallel.
//
// Strictly read-only and best-effort: NO turn increment, NO rate-limit
// increment, NO persistence, NO service retrieval, NO grounding. Any failure
// returns 200 { type: null } so the client silently falls back to neutral copy
// — a copy-picker must never surface an error or block the real reply.
//
// Mirrors /api/chat's classifyQuery inputs exactly (message / hasLifeEvent /
// hasEntitlements / conversationHistory / activeSituations) so the two
// classifications don't drift — using the NON-mutating situation-store
// resolution (loadActiveSituationRows + resolveSituations) rather than
// ensureSituationRows, which would lazily upsert a row (a write).
export async function POST(req: Request) {
  try {
    const { citizenId, messages, language = "es" } = await req.json()

    const userMessage: string = messages?.findLast?.((m: any) => m.role === "user")?.content ?? ""
    if (!userMessage) return NextResponse.json({ type: null })

    let hasLifeEvent = false
    let hasEntitlements = false
    let activeSituations: string[] = []

    if (citizenId && citizenId !== "anonymous") {
      const dbCtx = await prisma.citizenContext.findUnique({
        where: { citizenId },
        include: { citizen: true },
      })
      if (dbCtx) {
        const rows = await loadActiveSituationRows(citizenId)
        const resolved = resolveSituations(rows, {
          lifeEvent: dbCtx.lifeEvent,
          slotsJson: dbCtx.slotsJson,
          entitlementsJson: dbCtx.entitlementsJson,
          pendingSlot: dbCtx.pendingSlot,
        })
        activeSituations = resolved.activeLifeEvents
        hasLifeEvent = !!dbCtx.lifeEvent || activeSituations.length > 0
        const entitlements = JSON.parse(resolved.primary?.entitlementsJson || "[]")
        hasEntitlements = Array.isArray(entitlements) && entitlements.length > 0
      }
    }

    // Same recent-turns shaping as app/api/chat/route.ts (last 4, 120-char cap).
    const conversationHistory = (messages as any[])
      .slice(-4)
      .map(m => `${m.role}: ${String(m.content).slice(0, 120)}`)
      .join("\n")

    const classification = await classifyQuery({
      message: userMessage,
      hasLifeEvent,
      hasEntitlements,
      conversationHistory,
      activeSituations,
    })

    return NextResponse.json({ type: classification.type })
  } catch (e) {
    console.error("Classify pre-flight failed (best-effort — client falls back to neutral copy):", e)
    return NextResponse.json({ type: null })
  }
}
