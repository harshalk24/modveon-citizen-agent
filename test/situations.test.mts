import { test } from "node:test"
import assert from "node:assert/strict"

const { addSituation, removeSituation, getActiveSituations } = await import("../lib/situations")

// ── addSituation ──────────────────────────────────────────────────────
test("addSituation appends a new slug and makes it primary", () => {
  const state = { activeLifeEvents: ["new-baby"], lifeEvent: "new-baby" }
  const next = addSituation(state, "job-loss")
  assert.deepEqual(next.activeLifeEvents, ["new-baby", "job-loss"])
  assert.equal(next.lifeEvent, "job-loss")
})

test("addSituation on an empty state starts a one-element list", () => {
  const state = { activeLifeEvents: [], lifeEvent: null }
  const next = addSituation(state, "new-baby")
  assert.deepEqual(next.activeLifeEvents, ["new-baby"])
  assert.equal(next.lifeEvent, "new-baby")
})

test("addSituation is idempotent — adding an already-active slug is a no-op", () => {
  const state = { activeLifeEvents: ["new-baby", "job-loss"], lifeEvent: "job-loss" }
  const next = addSituation(state, "new-baby")
  assert.deepEqual(next.activeLifeEvents, ["new-baby", "job-loss"])
  assert.equal(next.lifeEvent, "job-loss") // primary unchanged — no reorder/re-primary
  assert.equal(next, state) // same reference — true no-op
})

// ── removeSituation ───────────────────────────────────────────────────
test("removeSituation drops the slug and re-primaries to the last remaining", () => {
  const state = { activeLifeEvents: ["new-baby", "job-loss"], lifeEvent: "job-loss" }
  const next = removeSituation(state, "job-loss")
  assert.deepEqual(next.activeLifeEvents, ["new-baby"])
  assert.equal(next.lifeEvent, "new-baby")
})

test("removeSituation clears lifeEvent to null when the last situation is removed", () => {
  const state = { activeLifeEvents: ["new-baby"], lifeEvent: "new-baby" }
  const next = removeSituation(state, "new-baby")
  assert.deepEqual(next.activeLifeEvents, [])
  assert.equal(next.lifeEvent, null)
})

test("removeSituation is a no-op when the slug isn't active", () => {
  const state = { activeLifeEvents: ["new-baby"], lifeEvent: "new-baby" }
  const next = removeSituation(state, "job-loss")
  assert.equal(next, state) // same reference — true no-op
})

// ── getActiveSituations ───────────────────────────────────────────────
test("getActiveSituations parses a populated activeLifeEvents JSON array", () => {
  const result = getActiveSituations({ activeLifeEvents: JSON.stringify(["new-baby", "job-loss"]), lifeEvent: "job-loss" })
  assert.deepEqual(result, ["new-baby", "job-loss"])
})

test("getActiveSituations falls back to [lifeEvent] when activeLifeEvents is the empty-array default", () => {
  const result = getActiveSituations({ activeLifeEvents: "[]", lifeEvent: "new-baby" })
  assert.deepEqual(result, ["new-baby"])
})

test("getActiveSituations falls back to [lifeEvent] when activeLifeEvents is missing/null", () => {
  assert.deepEqual(getActiveSituations({ lifeEvent: "new-baby" }), ["new-baby"])
  assert.deepEqual(getActiveSituations({ activeLifeEvents: null, lifeEvent: "new-baby" }), ["new-baby"])
})

test("getActiveSituations returns [] when there is no lifeEvent and no active list either", () => {
  assert.deepEqual(getActiveSituations({ activeLifeEvents: "[]", lifeEvent: null }), [])
  assert.deepEqual(getActiveSituations({}), [])
})

test("getActiveSituations falls back safely on malformed JSON instead of throwing", () => {
  assert.deepEqual(getActiveSituations({ activeLifeEvents: "{not valid json", lifeEvent: "new-baby" }), ["new-baby"])
})
