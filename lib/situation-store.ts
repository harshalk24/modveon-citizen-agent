// Task 2b-C1 — server-only DB persistence for per-situation state (the
// Situation table). Pairs with lib/situations.ts's PURE state-transform
// functions (addSituation/removeSituation/getActiveSituations), which stay
// client-safe and unchanged — this file wraps them with the actual DB reads/
// writes so the list-transform/idempotency/primary-computation logic lives
// in exactly one tested place (test/situations.test.mts) and this file is
// purely the persistence layer around it.
//
// NEVER import this from a "use client" component — it imports prisma
// (Node-only), and lib/situations.ts is the client-safe import for the pure
// helpers. Only server route handlers should import from here.
import { prisma } from "@/lib/prisma"
import { addSituation, removeSituation, SituationState } from "@/lib/situations"

export interface SituationRow {
  id: string
  citizenId: string
  lifeEvent: string
  slotsJson: string
  entitlementsJson: string
  pendingSlot: string | null
  status: string
  addedAt: Date
  updatedAt: Date
}

// A situation's per-turn state shaped identically whether it's backed by a
// real row or (transiently, read-only) resolved from the compat CitizenContext
// fields for a citizen whose only situation predates row-backing.
export interface ResolvedPrimary {
  lifeEvent: string
  slotsJson: string
  entitlementsJson: string
  pendingSlot: string | null
}

// The compat CitizenContext fields callers already have loaded — used to
// bootstrap/fall back to when a citizen has no Situation rows yet (their
// only situation predates row-backing: onboarding/profile-edit still write
// CitizenContext.lifeEvent directly, or the bulk backfill missed them).
export interface CompatCtx {
  lifeEvent: string | null
  slotsJson?: string | null
  entitlementsJson?: string | null
  pendingSlot?: string | null
}

// Ordered ascending by addedAt — mirrors lib/situations.ts's array convention
// exactly: the LAST element is primary (most-recently-added).
export async function loadActiveSituationRows(citizenId: string): Promise<SituationRow[]> {
  return prisma.situation.findMany({
    where: { citizenId, status: "active" },
    orderBy: { addedAt: "asc" },
  })
}

export function primaryRow(rows: SituationRow[]): SituationRow | null {
  return rows.length > 0 ? rows[rows.length - 1] : null
}

export function slugsOfRows(rows: SituationRow[]): string[] {
  return rows.map(r => r.lifeEvent)
}

// Non-mutating resolution for read-only callers (e.g. GET /api/citizen/me):
// uses rows as-is, falling back to the compat CitizenContext fields (same
// shape lib/situations.ts's getActiveSituations already falls back to) when
// there are no rows yet — no DB write, safe to call from a GET handler.
export function resolveSituations(
  rows: SituationRow[],
  compatCtx: CompatCtx
): { activeLifeEvents: string[]; primary: ResolvedPrimary | null } {
  if (rows.length > 0) return { activeLifeEvents: slugsOfRows(rows), primary: primaryRow(rows) }
  if (!compatCtx.lifeEvent) return { activeLifeEvents: [], primary: null }
  return {
    activeLifeEvents: [compatCtx.lifeEvent],
    primary: {
      lifeEvent: compatCtx.lifeEvent,
      slotsJson: compatCtx.slotsJson || "{}",
      entitlementsJson: compatCtx.entitlementsJson || "[]",
      pendingSlot: compatCtx.pendingSlot || null,
    },
  }
}

// Mutating counterpart: same resolution, but lazily persists a row for a
// citizen whose only situation predates row-backing (onboarding/profile-edit
// wrote CitizenContext.lifeEvent directly, or the bulk backfill missed them)
// — seeded with their CURRENT shared slots/entitlements/pendingSlot, the same
// one-time migration the bulk backfill script does, just lazy and per-citizen.
// After this call, "primary" is guaranteed to be a real, persisted row
// whenever compatCtx.lifeEvent is set — callers that are about to WRITE
// per-situation state (chat route's slot-filling/entitlements) never need a
// second bootstrap-fallback branch.
export async function ensureSituationRows(
  citizenId: string,
  compatCtx: CompatCtx
): Promise<SituationRow[]> {
  const rows = await loadActiveSituationRows(citizenId)
  if (rows.length > 0 || !compatCtx.lifeEvent) return rows

  const created = await prisma.situation.upsert({
    where: { citizenId_lifeEvent: { citizenId, lifeEvent: compatCtx.lifeEvent } },
    create: {
      citizenId,
      lifeEvent: compatCtx.lifeEvent,
      slotsJson: compatCtx.slotsJson || "{}",
      entitlementsJson: compatCtx.entitlementsJson || "[]",
      pendingSlot: compatCtx.pendingSlot || null,
      status: "active",
    },
    update: {},
  })
  return [created]
}

// Bootstraps the "current" state input for the pure addSituation/removeSituation
// transforms — same fallback-to-compat shape as resolveSituations above.
function currentStateFromRows(rows: SituationRow[], compatLifeEvent: string | null): SituationState {
  if (rows.length > 0) return { activeLifeEvents: slugsOfRows(rows), lifeEvent: primaryRow(rows)!.lifeEvent }
  return compatLifeEvent ? { activeLifeEvents: [compatLifeEvent], lifeEvent: compatLifeEvent } : { activeLifeEvents: [], lifeEvent: null }
}

// Always-add flow (Phase 2a), now backed by Situation rows. Reuses the
// existing, tested pure addSituation for the list transform (idempotency,
// primary computation) — this function is purely the DB-persistence wrapper,
// so behavior is byte-identical to before the migration; only the storage
// location changed.
//
// Calls ensureSituationRows FIRST (not just loadActiveSituationRows) so a
// pre-existing situation that predates row-backing gets its row correctly
// seeded from its REAL slots/entitlements/pendingSlot before we add the new
// one — a bare loadActiveSituationRows + bootstrap-with-defaults here would
// silently wipe that citizen's already-filled slots the moment they add a
// second situation, exactly the "wipe on add" bug Step 4 of the migration
// doc calls out. Idempotent/cheap to call even when the caller already ran
// ensureSituationRows earlier in the same request (route.ts's ctx-building
// does) — one extra indexed read in that case, correctness either way.
export async function addSituationRow(citizenId: string, slug: string, compatCtx: CompatCtx): Promise<SituationState> {
  const rows = await ensureSituationRows(citizenId, compatCtx)
  const current = currentStateFromRows(rows, compatCtx.lifeEvent)
  const next = addSituation(current, slug)
  if (next === current) return next // already active — true no-op, matches lib/situations.ts's contract

  await prisma.situation.upsert({
    where: { citizenId_lifeEvent: { citizenId, lifeEvent: slug } },
    create: { citizenId, lifeEvent: slug, status: "active" },
    update: { status: "active", addedAt: new Date() },
  })
  await prisma.citizenContext.upsert({
    where: { citizenId },
    create: { citizenId, lifeEvent: next.lifeEvent, updatedAt: new Date() },
    update: { lifeEvent: next.lifeEvent },
  })
  return next
}

// Remove-as-safety-valve (Phase 2a Step 6), now backed by Situation rows —
// deletes the row outright (drops its slots, per lib/situations.ts's design).
// Same ensureSituationRows-first reasoning as addSituationRow above — a
// citizen removing their SECOND situation while their first still predates
// row-backing must not lose that first situation's slots in the process.
export async function removeSituationRow(citizenId: string, slug: string, compatCtx: CompatCtx): Promise<SituationState> {
  const rows = await ensureSituationRows(citizenId, compatCtx)
  const current = currentStateFromRows(rows, compatCtx.lifeEvent)
  const next = removeSituation(current, slug)
  if (next === current) return next // wasn't active — true no-op

  await prisma.situation.deleteMany({ where: { citizenId, lifeEvent: slug } })
  await prisma.citizenContext.upsert({
    where: { citizenId },
    create: { citizenId, lifeEvent: next.lifeEvent, updatedAt: new Date() },
    update: { lifeEvent: next.lifeEvent },
  })
  return next
}

// Persists slot-filling state to a specific situation's row. Task 2b-C2:
// the target is whichever situation THIS turn is about (query-relevant),
// not always the primary — see route.ts's target-mapping. Callers only ever
// reach this for a situation that's actually in allSituationRows (a real,
// persisted row via ensureSituationRows during ctx-building), so there's no
// fallback branch to worry about here.
export async function updateSituationSlots(citizenId: string, lifeEvent: string, slotsJson: string, pendingSlot: string | null): Promise<void> {
  await prisma.situation.update({
    where: { citizenId_lifeEvent: { citizenId, lifeEvent } },
    data: { slotsJson, pendingSlot },
  })
}

// Persists entitlements to the PRIMARY situation's row — same guarantee as
// updatePrimarySlots above (only reached when a primary row exists).
export async function updatePrimaryEntitlements(citizenId: string, primaryLifeEvent: string, entitlementsJson: string): Promise<void> {
  await prisma.situation.update({
    where: { citizenId_lifeEvent: { citizenId, lifeEvent: primaryLifeEvent } },
    data: { entitlementsJson },
  })
}

// Task ENTITLEMENT_STATUS: toggles a single entitlement's status, mirroring
// Deadline.completed's boolean-toggle shape (and /api/plan/step's PATCH
// pattern) for the JSON-blob-backed entitlements array — the "Benefits
// claimed" Dashboard progress row (app/dashboard/page.tsx) filters on
// status==="received", but until this nothing ever wrote anything besides
// "new", so that row was permanently stuck at 0.
//
// Scoped to the PRIMARY row ONLY — same scope updatePrimaryEntitlements
// above already uses, because that's the only copy any reader (GET
// /api/citizen/me, the Dashboard) ever looks at. A serviceId can appear in a
// NON-primary situation's entitlementsJson too — each situation's array is a
// snapshot from whenever IT was last primary, so once primary shifts, older
// situations' arrays go stale and un-read. (Confirmed live: a first version
// of this searched every active row and updated the first match by row
// order, which silently patched a demoted situation's stale, never-read
// copy instead of the live one — exactly the "write path A, read path B"
// divergence this codebase has repeatedly had to hunt down elsewhere.)
// Returns false (caller 404s) if the serviceId isn't in the primary's
// array — same "don't leak/guess, just say not found" convention as
// getConversationMessages/conversationExists.
export async function updateEntitlementStatus(
  citizenId: string,
  serviceId: string,
  received: boolean
): Promise<boolean> {
  const rows = await loadActiveSituationRows(citizenId)
  const primary = primaryRow(rows)
  if (!primary) return false

  const entitlements: { serviceId: string; status: string; savedAt?: string; receivedAt?: string }[] =
    JSON.parse(primary.entitlementsJson || "[]")
  const idx = entitlements.findIndex(e => e.serviceId === serviceId)
  if (idx === -1) return false

  entitlements[idx] = {
    ...entitlements[idx],
    status: received ? "received" : "new",
    receivedAt: received ? new Date().toISOString() : undefined,
  }
  await updatePrimaryEntitlements(citizenId, primary.lifeEvent, JSON.stringify(entitlements))
  return true
}
