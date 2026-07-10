// Shape read-tolerance for saved plans (Task S2). ActionPlan.planJson has
// existed in three shapes over this app's lifetime:
//   1. a flat array of steps, each already carrying its own `week` (oldest)
//   2. { weeks: [{ week, label, steps }] } (pre-S2 — calendar-week framing)
//   3. { phases: [{ phase, label, steps }] } (current — dependency-rank framing)
// New writes always use shape 3. Existing rows in shapes 1/2 must keep
// working without a migration script — these helpers normalize on read and
// preserve whichever shape a row was already in on write, so a step toggle
// on an old plan doesn't silently change its stored container shape.

export interface FlatStep {
  serviceId: string
  phase: number
  [key: string]: unknown
}

type RawPlan = { phases?: any[]; weeks?: any[] } | any[]

// Always emits `phase`-tagged flat steps, regardless of source shape.
export function flattenPlanSteps(raw: RawPlan): FlatStep[] {
  if (Array.isArray(raw)) {
    // Oldest shape — each item already carries its own `week` (or nothing).
    return raw.map((s: any) => ({ ...s, phase: s.phase ?? s.week ?? 1 }))
  }
  if (raw?.phases) {
    return raw.phases.flatMap((p: any) => (p.steps || []).map((s: any) => ({ ...s, phase: p.phase })))
  }
  if (raw?.weeks) {
    return raw.weeks.flatMap((w: any) => (w.steps || []).map((s: any) => ({ ...s, phase: w.week })))
  }
  return []
}

// Rebuilds whatever container shape `raw` was already in, using an updated
// flat step list — so toggling one step's status never rewrites an old plan
// from `weeks` shape into `phases` shape (or vice versa) as a side effect.
export function rebuildPlanFromSteps(raw: RawPlan, steps: FlatStep[]): RawPlan {
  if (Array.isArray(raw)) {
    return steps
  }
  if (raw?.phases) {
    const byPhase = new Map<number, any[]>()
    for (const s of steps) {
      if (!byPhase.has(s.phase)) byPhase.set(s.phase, [])
      byPhase.get(s.phase)!.push(s)
    }
    return {
      phases: raw.phases
        .map((p: any) => ({ ...p, steps: byPhase.get(p.phase) || [] }))
        .filter((p: any) => p.steps.length > 0),
    }
  }
  if (raw?.weeks) {
    const byWeek = new Map<number, any[]>()
    for (const s of steps) {
      if (!byWeek.has(s.phase)) byWeek.set(s.phase, [])
      byWeek.get(s.phase)!.push(s)
    }
    return {
      weeks: raw.weeks
        .map((w: any) => ({ ...w, week: w.week, steps: byWeek.get(w.week) || [] }))
        .filter((w: any) => w.steps.length > 0),
    }
  }
  return { phases: [] }
}
