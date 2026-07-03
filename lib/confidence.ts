// Central confidence gate. Thresholds live here ONLY — no scattered magic
// numbers at call sites. Parse/classification failures must resolve to
// confidence 0 upstream, so every gate below fails closed by construction.

export const CONFIDENCE_THRESHOLDS = {
  intent:       0.70,
  durableWrite: 0.80,
} as const

export interface Confidence {
  confidence: number
}

// A turn may always reply — this threshold is for lower-stakes decisions
// that aren't durable writes. Not wired to any write path yet.
export function meetsIntentConfidence(c: Confidence): boolean {
  return c.confidence >= CONFIDENCE_THRESHOLDS.intent
}

// Any durable/irreversible write (profile, context, plan) must clear this bar.
export function canWriteDurable(c: Confidence): boolean {
  return c.confidence >= CONFIDENCE_THRESHOLDS.durableWrite
}

export function canWriteProfile(c: Confidence): boolean {
  return canWriteDurable(c)
}
