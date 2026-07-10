import { test } from "node:test"
import assert from "node:assert/strict"

const { flattenPlanSteps, rebuildPlanFromSteps } = await import("../lib/plan-shape")

// ── flattenPlanSteps: read-tolerance for all three historical shapes ─────
test("flattenPlanSteps reads the current { phases: [...] } shape", () => {
  const raw = { phases: [
    { phase: 1, label: "Phase 1", steps: [{ serviceId: "a", status: "done" }] },
    { phase: 2, label: "Phase 2", steps: [{ serviceId: "b" }] },
  ] }
  const steps = flattenPlanSteps(raw)
  assert.equal(steps.length, 2)
  assert.deepEqual(steps.map(s => [s.serviceId, s.phase]), [["a", 1], ["b", 2]])
})

test("flattenPlanSteps read-tolerates the old { weeks: [...] } shape — existing plans must not break", () => {
  const raw = { weeks: [
    { week: 1, label: "Week 1", steps: [{ serviceId: "a" }] },
    { week: 2, label: "Week 2", steps: [{ serviceId: "b" }] },
  ] }
  const steps = flattenPlanSteps(raw)
  assert.equal(steps.length, 2)
  // week -> phase mapping: the OLD field name must surface as `phase` so the
  // plan page's (renamed) groupStepsByPhase/toggle logic works uniformly.
  assert.deepEqual(steps.map(s => [s.serviceId, s.phase]), [["a", 1], ["b", 2]])
  assert.equal((steps[0] as any).week, undefined, "should not leak the old field name")
})

test("flattenPlanSteps read-tolerates the oldest flat-array shape", () => {
  const raw = [{ serviceId: "a", week: 1 }, { serviceId: "b" }]
  const steps = flattenPlanSteps(raw)
  assert.equal(steps.length, 2)
  assert.equal(steps[0].phase, 1)
  assert.equal(steps[1].phase, 1, "a step with no phase/week at all defaults to phase 1")
})

test("flattenPlanSteps returns an empty array for an unrecognized/empty shape", () => {
  assert.deepEqual(flattenPlanSteps({} as any), [])
})

// ── rebuildPlanFromSteps: write-back preserves the ORIGINAL container shape ─
test("rebuildPlanFromSteps preserves the { phases: [...] } shape on write", () => {
  const raw = { phases: [{ phase: 1, label: "Phase 1", steps: [{ serviceId: "a" }] }] }
  const steps = flattenPlanSteps(raw).map(s => ({ ...s, status: "done" }))
  const rebuilt: any = rebuildPlanFromSteps(raw, steps)
  assert.ok(rebuilt.phases, "must still be phases-shaped, not weeks")
  assert.equal(rebuilt.phases[0].steps[0].status, "done")
})

test("rebuildPlanFromSteps preserves the OLD { weeks: [...] } shape on write — never silently upgrades an old plan's container shape", () => {
  const raw = { weeks: [{ week: 1, label: "Week 1", steps: [{ serviceId: "a" }] }] }
  const steps = flattenPlanSteps(raw).map(s => ({ ...s, status: "done" }))
  const rebuilt: any = rebuildPlanFromSteps(raw, steps)
  assert.ok(rebuilt.weeks, "an old plan must round-trip back into weeks shape, not phases")
  assert.equal(rebuilt.weeks[0].steps[0].status, "done")
})

test("rebuildPlanFromSteps preserves the flat-array shape on write", () => {
  const raw = [{ serviceId: "a", week: 1 }]
  const steps = flattenPlanSteps(raw).map(s => ({ ...s, status: "done" }))
  const rebuilt = rebuildPlanFromSteps(raw, steps)
  assert.ok(Array.isArray(rebuilt))
})

test("rebuildPlanFromSteps drops an emptied-out phase (step deleted) — mirrors buildSafeFallbackPlan's never-drop-real-data intent for the OTHER phases", () => {
  const raw = { phases: [
    { phase: 1, label: "Phase 1", steps: [{ serviceId: "a" }] },
    { phase: 2, label: "Phase 2", steps: [{ serviceId: "b" }] },
  ] }
  const steps = flattenPlanSteps(raw).filter(s => s.serviceId !== "a") // simulate a DELETE
  const rebuilt: any = rebuildPlanFromSteps(raw, steps)
  assert.equal(rebuilt.phases.length, 1)
  assert.equal(rebuilt.phases[0].steps[0].serviceId, "b")
})
