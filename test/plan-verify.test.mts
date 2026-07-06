import { test } from "node:test"
import assert from "node:assert/strict"

const { computeRanks, verifyPlanOrder, reorderPlan, buildSafeFallbackPlan, enforcePlanCosts } = await import("../lib/plan-verify")
const { services: fullKB } = await import("../lib/kb")

const birthCert = fullKB.find(s => s.id === "sv-rnpn-birth-registration")
const dependentEnrollment = fullKB.find(s => s.id === "sv-isss-dependent-enrollment")
const childSubsidy = fullKB.find(s => s.id === "sv-child-subsidy")
const cnr = fullKB.find(s => s.id === "sv-cnr-business-registration")
const nit = fullKB.find(s => s.id === "sv-mh-nit")
const licence = fullKB.find(s => s.id === "sv-alcaldia-operating-licence")
if (!birthCert || !dependentEnrollment || !childSubsidy || !cnr || !nit || !licence) {
  throw new Error("Expected KB entries not found — did lib/kb.ts IDs change?")
}

const genericLabel = (week: number) => `Week ${week}`

// ── computeRanks: the corrected topological batching ────────────────────
test("computeRanks orders new-baby dependency chain correctly", () => {
  const ids = [birthCert.id, dependentEnrollment.id, childSubsidy.id]
  const ranks = computeRanks(ids, [birthCert, dependentEnrollment, childSubsidy])
  assert.ok(ranks.get(birthCert.id)! < ranks.get(dependentEnrollment.id)!)
  assert.ok(ranks.get(birthCert.id)! < ranks.get(childSubsidy.id)!)
})

test("computeRanks orders the business registration chain (CNR -> NIT -> licence)", () => {
  const ids = [cnr.id, nit.id, licence.id]
  const ranks = computeRanks(ids, [cnr, nit, licence])
  assert.ok(ranks.get(cnr.id)! < ranks.get(nit.id)!)
  assert.ok(ranks.get(nit.id)! < ranks.get(licence.id)!)
})

test("computeRanks treats a dependency NOT in the input set as already satisfied", () => {
  // dependentEnrollment depends on birthCert, but birthCert isn't in this batch
  // at all (e.g. filtered out upstream) — it must not block forever.
  const ids = [dependentEnrollment.id]
  const ranks = computeRanks(ids, [dependentEnrollment])
  assert.equal(ranks.get(dependentEnrollment.id), 0)
})

test("computeRanks degrades gracefully on a genuine cycle instead of dropping services", () => {
  const a: any = { id: "cycle-a", dependsOn: ["cycle-b"] }
  const b: any = { id: "cycle-b", dependsOn: ["cycle-a"] }
  const ranks = computeRanks(["cycle-a", "cycle-b"], [a, b])
  assert.equal(ranks.size, 2, "both cyclic services must still appear in the output")
})

// ── verifyPlanOrder / reorderPlan ────────────────────────────────────────
test("verifyPlanOrder passes a correctly-ordered plan", () => {
  const plan = {
    weeks: [
      { week: 1, label: "Week 1", steps: [{ serviceId: birthCert.id, title: birthCert.name }] },
      { week: 2, label: "Week 2", steps: [
        { serviceId: dependentEnrollment.id, title: dependentEnrollment.name },
        { serviceId: childSubsidy.id, title: childSubsidy.name },
      ] },
    ],
  }
  const result = verifyPlanOrder(plan, [birthCert, dependentEnrollment, childSubsidy])
  assert.equal(result.ok, true, JSON.stringify(result.violations))
})

test("verifyPlanOrder catches a dependent step scheduled BEFORE its dependency", () => {
  // Violation: dependentEnrollment (week 1) needs birthCert (week 2) — backwards.
  const plan = {
    weeks: [
      { week: 1, label: "Week 1", steps: [{ serviceId: dependentEnrollment.id, title: dependentEnrollment.name }] },
      { week: 2, label: "Week 2", steps: [{ serviceId: birthCert.id, title: birthCert.name }] },
    ],
  }
  const result = verifyPlanOrder(plan, [birthCert, dependentEnrollment])
  assert.equal(result.ok, false, "must never wrongly approve a backwards-ordered plan")
  assert.ok(result.violations.length > 0)
})

test("reorderPlan fixes a violation while preserving each step's own content", () => {
  const plan = {
    weeks: [
      { week: 1, label: "Week 1", steps: [{ serviceId: dependentEnrollment.id, title: "Custom LLM title for dependent enrollment" }] },
      { week: 2, label: "Week 2", steps: [{ serviceId: birthCert.id, title: "Custom LLM title for birth cert" }] },
    ],
  }
  const fixed = reorderPlan(plan, [birthCert, dependentEnrollment], genericLabel)
  const recheck = verifyPlanOrder(fixed, [birthCert, dependentEnrollment])
  assert.equal(recheck.ok, true, JSON.stringify(recheck.violations))

  // Step content must be untouched — only week placement changes.
  const allSteps = fixed.weeks.flatMap(w => w.steps)
  const dep = allSteps.find(s => s.serviceId === dependentEnrollment.id)
  const cert = allSteps.find(s => s.serviceId === birthCert.id)
  assert.equal(dep?.title, "Custom LLM title for dependent enrollment")
  assert.equal(cert?.title, "Custom LLM title for birth cert")
})

test("reorderPlan resolves the CNR -> NIT -> licence chain even if fully reversed", () => {
  const plan = {
    weeks: [
      { week: 1, label: "Week 1", steps: [{ serviceId: licence.id, title: licence.name }] },
      { week: 2, label: "Week 2", steps: [{ serviceId: nit.id, title: nit.name }] },
      { week: 3, label: "Week 3", steps: [{ serviceId: cnr.id, title: cnr.name }] },
    ],
  }
  const fixed = reorderPlan(plan, [cnr, nit, licence], genericLabel)
  const recheck = verifyPlanOrder(fixed, [cnr, nit, licence])
  assert.equal(recheck.ok, true, JSON.stringify(recheck.violations))
})

// ── buildSafeFallbackPlan: must never fabricate a cost or duration ──────
test("buildSafeFallbackPlan never hardcodes Free or a fabricated duration", () => {
  const compact = [birthCert, dependentEnrollment, childSubsidy].map(s => ({
    id: s.id, name: s.name, agency: s.agency, agencyAddress: s.sourceUrl,
    documents: s.documents, deadline: s.deadline, dependsOn: s.dependsOn,
    blocks: s.blocks, amount: s.amount, confidence: s.confidence, reviewStatus: s.reviewStatus,
  }))
  const fallback = buildSafeFallbackPlan(compact as any, "en")
  const allSteps = fallback.weeks.flatMap(w => w.steps)

  for (const step of allSteps) {
    assert.notEqual(step.cost, "Free", `step for ${step.serviceId} must not hardcode "Free"`)
    assert.ok(!String(step.estimatedTime).includes("30 minutes"), `step for ${step.serviceId} must not fabricate a "30 minutes" duration`)
  }
  // childSubsidy has a real amount ($50/mo) — it should be used, not discarded.
  const subsidyStep = allSteps.find(s => s.serviceId === childSubsidy.id)
  assert.ok(subsidyStep?.cost.includes("$50"), "should use the real KB amount when present")
})

test("buildSafeFallbackPlan still respects dependency order", () => {
  const compact = [dependentEnrollment, birthCert, childSubsidy].map(s => ({
    id: s.id, name: s.name, agency: s.agency, agencyAddress: s.sourceUrl,
    documents: s.documents, deadline: s.deadline, dependsOn: s.dependsOn,
    blocks: s.blocks, amount: s.amount, confidence: s.confidence, reviewStatus: s.reviewStatus,
  }))
  const fallback = buildSafeFallbackPlan(compact as any, "en")
  const check = verifyPlanOrder(fallback, [birthCert, dependentEnrollment, childSubsidy])
  assert.equal(check.ok, true, JSON.stringify(check.violations))
})

test("buildSafeFallbackPlan hedges cost for an unverified service with no confirmed amount", () => {
  // sv-cnr-business-registration is reviewStatus: "needs_review" as of this test.
  const compact = [{
    id: cnr.id, name: cnr.name, agency: cnr.agency, agencyAddress: cnr.sourceUrl,
    documents: cnr.documents, deadline: cnr.deadline, dependsOn: cnr.dependsOn,
    blocks: cnr.blocks, amount: undefined, confidence: cnr.confidence, reviewStatus: cnr.reviewStatus,
  }]
  const fallback = buildSafeFallbackPlan(compact as any, "en")
  const step = fallback.weeks[0].steps[0]
  assert.ok(step.cost.toLowerCase().includes("not confirmed") || step.cost.toLowerCase().includes("confirm"))
})

// ── enforcePlanCosts: never let a fabricated/unbacked cost reach a plan step ─
const birthCertNode = {
  id: birthCert.id, agency: birthCert.agency, amount: birthCert.amount,
  deadline: birthCert.deadline, confidence: birthCert.confidence,
  reviewStatus: birthCert.reviewStatus, costUncertain: birthCert.costUncertain,
}

test("enforcePlanCosts corrects a fabricated 'Free' on an entry with a real (approved, costUncertain) amount", () => {
  // This is the exact birth-reg bug: LLM invents "Free" for a plan step even
  // though the entry is approved and has a real, tiered cost.
  const plan = { weeks: [{ week: 1, label: "W1", steps: [{ serviceId: birthCert.id, title: birthCert.name, cost: "Free" }] }] }
  const fixed = enforcePlanCosts(plan, [birthCertNode])
  const cost = fixed.weeks[0].steps[0].cost as string
  assert.notEqual(cost.toLowerCase(), "free")
  assert.ok(cost.includes("$3") || cost.toLowerCase().includes("varies"), cost)
})

test("enforcePlanCosts corrects a flat single figure on a costUncertain entry to include variance framing", () => {
  const plan = { weeks: [{ week: 1, label: "W1", steps: [{ serviceId: birthCert.id, title: birthCert.name, cost: "$20" }] }] }
  const fixed = enforcePlanCosts(plan, [birthCertNode])
  const cost = fixed.weeks[0].steps[0].cost as string
  assert.notEqual(cost, "$20")
})

test("enforcePlanCosts leaves an already-correct, variance-framed cost untouched", () => {
  const plan = { weeks: [{ week: 1, label: "W1", steps: [{ serviceId: birthCert.id, title: birthCert.name, cost: birthCert.amount }] }] }
  const fixed = enforcePlanCosts(plan, [birthCertNode])
  assert.equal(fixed.weeks[0].steps[0].cost, birthCert.amount)
})

test("enforcePlanCosts never lets a cost claim through for an entry with no structured amount at all", () => {
  const noAmountNode = { id: "test-no-amount", agency: "Test Agency" }
  const plan = { weeks: [{ week: 1, label: "W1", steps: [{ serviceId: "test-no-amount", title: "Test service", cost: "Free" }] }] }
  const fixed = enforcePlanCosts(plan, [noAmountNode as any])
  const cost = fixed.weeks[0].steps[0].cost as string
  assert.notEqual(cost.toLowerCase(), "free")
  assert.ok(cost.toLowerCase().includes("not confirmed") || cost.toLowerCase().includes("confirm"), cost)
})

test("enforcePlanCosts corrects a dollar figure that doesn't match the KB amount at all", () => {
  const compact = {
    id: cnr.id, agency: cnr.agency, amount: cnr.amount, confidence: cnr.confidence, reviewStatus: cnr.reviewStatus,
  }
  const plan = { weeks: [{ week: 1, label: "W1", steps: [{ serviceId: cnr.id, title: cnr.name, cost: "$999" }] }] }
  const fixed = enforcePlanCosts(plan, [compact as any])
  assert.notEqual(fixed.weeks[0].steps[0].cost, "$999")
})
