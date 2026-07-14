// Single funnel for all writes to a citizen's active situations (Phase 2a),
// so the plural `activeLifeEvents` list and the compat singular `lifeEvent`
// field can never drift apart. `lifeEvent` is defined as "primary = the
// most-recently-added situation" — existing singular readers keep working
// unchanged. Full migration off `lifeEvent` is Phase 2b (see TASK_MULTICONTEXT).
import { Service, lookupServices } from "./kb"

export interface SituationState {
  activeLifeEvents: string[]
  lifeEvent: string | null
}

// Append if absent; primary (lifeEvent) becomes the newly-added slug.
// Idempotent — calling with a slug that's already active is a no-op (same
// object back), so it can never duplicate an entry or silently re-primary
// a situation that didn't actually change.
export function addSituation(state: SituationState, slug: string): SituationState {
  if (state.activeLifeEvents.includes(slug)) return state
  return { activeLifeEvents: [...state.activeLifeEvents, slug], lifeEvent: slug }
}

// Drop slug; primary becomes the last remaining (most-recently-added of
// what's left), or null if none remain. No-op if slug isn't active.
export function removeSituation(state: SituationState, slug: string): SituationState {
  if (!state.activeLifeEvents.includes(slug)) return state
  const activeLifeEvents = state.activeLifeEvents.filter(s => s !== slug)
  const lifeEvent = activeLifeEvents.length > 0 ? activeLifeEvents[activeLifeEvents.length - 1] : null
  return { activeLifeEvents, lifeEvent }
}

// Parses the DB's activeLifeEvents JSON string into an array, falling back
// to [lifeEvent] when empty/missing/malformed — covers rows the backfill
// script hasn't reached yet, or any client-side context missing the field.
export function getActiveSituations(ctx: { activeLifeEvents?: string | null; lifeEvent?: string | null }): string[] {
  let parsed: unknown = []
  try {
    parsed = ctx.activeLifeEvents ? JSON.parse(ctx.activeLifeEvents) : []
  } catch {
    parsed = []
  }
  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(s => typeof s === "string")) {
    return parsed as string[]
  }
  return ctx.lifeEvent ? [ctx.lifeEvent] : []
}

export type SituationTaggedService = Service & { _situations: string[] }

// Client-side counterpart to lib/semantic-search.ts's backdrop union (no
// semantic/foreground layer here — this is the deterministic situation-based
// lookup used to generate the merged plan, Phase 2a Step 5). A single-element
// `situations` array behaves exactly like the old single-lifeEvent
// lookupServices call, so existing single-situation citizens see no change.
export function unionServicesForSituations(params: {
  country: string
  situations: string[]
  employment: string
  slots?: Record<string, string>
}): SituationTaggedService[] {
  const map = new Map<string, SituationTaggedService>()
  for (const situ of params.situations) {
    const matches = lookupServices({ country: params.country, lifeEvent: situ, employment: params.employment, slots: params.slots })
    for (const s of matches) {
      const existing = map.get(s.id)
      if (existing) existing._situations.push(situ)
      else map.set(s.id, { ...s, _situations: [situ] })
    }
  }
  return [...map.values()]
}
