import { prisma } from "@/lib/prisma"

// Task M1 — measurement only, never a behavior change. Same fire-and-forget
// shape as lib/audit.ts's logResponse: never awaited by the caller, never
// throws into the reply path.

export interface GroundingAttempt {
  attempt: number
  draft: string
  stage?: "entity" | "value" | "faithfulness"
  reasons?: string[]
  passed: boolean
}

export interface GroundingFallbackEntry {
  citizenId?: string
  sessionId?: string
  query: string
  attempts: GroundingAttempt[]
  outcome: "regenerated" | "fell-back"
  finalReply: string
}

// Only called for turns that did NOT pass on the first attempt — turns that
// pass immediately aren't logged here, keeping this table focused on exactly
// what needs hand review (per Task M1: legitimate catch vs. over-strict judge).
//
// Wrapped in try/catch (not just a promise .catch()) — a SYNCHRONOUS error
// (e.g. an undefined prisma property from a stale generated client after a
// schema change) throws before a promise even exists, bypassing .catch()
// entirely and crashing the caller. Measurement logging must never turn a
// successful reply into a 500.
export function logGroundingFallback(entry: GroundingFallbackEntry): void {
  try {
    prisma.groundingFallback
      .create({
        data: {
          citizenId: entry.citizenId,
          sessionId: entry.sessionId,
          query: entry.query,
          attemptsJson: JSON.stringify(entry.attempts),
          outcome: entry.outcome,
          finalReply: entry.finalReply,
        },
      })
      .catch(console.error)
  } catch (err) {
    console.error("logGroundingFallback failed synchronously — measurement logging must never break a reply:", err)
  }
}
