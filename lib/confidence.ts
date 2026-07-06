// Central confidence gate. Thresholds live here ONLY — no scattered magic
// numbers at call sites. Parse/classification failures must resolve to
// confidence 0 upstream, so every gate below fails closed by construction.

export const CONFIDENCE_THRESHOLDS = {
  intent:       0.70,
  durableWrite: 0.80,
  lifeEvent:    0.75,
  employment:   0.75,
  memoryType:   0.75,
} as const

export interface Confidence {
  confidence: number
}

export interface FacetConfidence {
  lifeEventConfidence?: number
  employmentConfidence?: number
  memoryTypeConfidence?: number
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

// Per-facet gates for classifier-detected life event / employment (Task 3).
export function canWriteLifeEvent(c: FacetConfidence): boolean {
  return (c.lifeEventConfidence ?? 0) >= CONFIDENCE_THRESHOLDS.lifeEvent
}

export function canWriteEmployment(c: FacetConfidence): boolean {
  return (c.employmentConfidence ?? 0) >= CONFIDENCE_THRESHOLDS.employment
}

// Gate for the classifier's memoryType facet (Task 4). Governs whether a
// memoryType label is acted on (durable-write logging, episodic logging) —
// it does not replace canWriteLifeEvent/canWriteEmployment, which still
// govern the actual profile writes.
export function canWriteMemoryType(c: FacetConfidence): boolean {
  return (c.memoryTypeConfidence ?? 0) >= CONFIDENCE_THRESHOLDS.memoryType
}
