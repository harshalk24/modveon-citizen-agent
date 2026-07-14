import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

// Minimal .env.local loader — same pattern as confidence.test.mts.
function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.replace(/\r$/, "")
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1")
  }
}
loadDotEnvLocal()

const { check, checkEntities, checkValues } = await import("../lib/grounding")
const { services: fullKB } = await import("../lib/kb")
const { buildKBFacts } = await import("../lib/context-builder")

const hasKey = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key"

const birthCert = fullKB.find(s => s.id === "sv-rnpn-birth-registration")
const dependentEnrollment = fullKB.find(s => s.id === "sv-isss-dependent-enrollment")
const maternityBenefit = fullKB.find(s => s.id === "sv-isss-maternity-benefit")
if (!birthCert || !dependentEnrollment || !maternityBenefit) {
  throw new Error("Expected KB entries not found — did lib/kb.ts IDs change?")
}

// Synthetic fixture for unverified-entry edge cases — deliberately NOT tied to a
// real KB entry's current reviewStatus/confidence, which changes as content gets
// verified over time (see: birthCert used to be needs_review, now approved).
// description/universalTip are overridden (not just spread from birthCert) so the
// faithfulness stage doesn't see birthCert's real, now-conflicting cost content.
const unverifiedFixture = {
  ...birthCert,
  id: "test-unverified-fixture",
  name: "Test Sample Service",
  nameEs: "Servicio de Prueba Muestra",
  description: "A sample service used only for grounding unit tests.",
  descriptionEs: "Un servicio de muestra usado solo para pruebas de grounding.",
  universalTip: "This is a placeholder tip for testing — the fee is reported around $3.50, but this is not confirmed.",
  amount: undefined,
  confidence: 0.5,
  reviewStatus: "needs_review" as const,
}

// ── Stage 1: entity check (deterministic, no API key needed) ────────────
test("checkEntities passes when the reply only cites retrieved services", () => {
  const reply = `Here's what you need: **${birthCert.name}** from RNPN.`
  const result = checkEntities(reply, [birthCert], fullKB)
  assert.equal(result.ok, true)
})

test("checkEntities fails a fabricated-entity reply — never wrongly passes", () => {
  // maternityBenefit is a REAL KB scheme, but not in the retrieved set.
  const reply = `Here's what you need: **${birthCert.name}** from RNPN. You also qualify for **${maternityBenefit.name}**.`
  const result = checkEntities(reply, [birthCert], fullKB)
  assert.equal(result.ok, false, "must never wrongly approve a reply citing an unretrieved scheme")
  assert.ok(result.problems.length > 0)
})

// ── Stage 2: value check (deterministic, no API key needed) ─────────────
test("checkValues passes when stated numbers match the retrieved service", () => {
  const reply = `**${dependentEnrollment.name}** — you must enroll within 365 days of birth.`
  const result = checkValues(reply, [dependentEnrollment])
  assert.equal(result.ok, true)
})

test("checkValues fails a wrong-number reply — never wrongly passes", () => {
  // dependentEnrollment.deadlineDays is 365, not 30 — a classic "right scheme, wrong number".
  const reply = `**${dependentEnrollment.name}** — you must enroll within 30 days of birth.`
  const result = checkValues(reply, [dependentEnrollment])
  assert.equal(result.ok, false, "must never wrongly approve a reply with an incorrect deadline")
  assert.ok(result.problems.length > 0)
})

test("checkValues hedge detection is word-boundary, not substring — a keyword embedded in the entry's OWN name must not fake a hedge", () => {
  // Regression test (KB fail-closed task): dependentEnrollment's name is
  // "Enroll baby as ISSS dependent" — the substring "depend" inside
  // "dependent" must NOT register as the hedge keyword "depend". Before the
  // word-boundary fix, checkValues found "depend" via block.includes("depend")
  // in the service's own name (always present in its block) and wrongly
  // treated every reply about this service as pre-hedged, silently
  // swallowing a real, unhedged wrong-number mismatch. dependentEnrollment is
  // needs_review (unannotated → marked in the KB fail-closed task), so this
  // mismatch must still be caught, not hedge-excused by its own name.
  const reply = `**${dependentEnrollment.name}** — you must enroll within 30 days of birth.`
  const result = checkValues(reply, [dependentEnrollment])
  assert.equal(result.ok, false, "the entry's own name containing 'depend' (from 'dependent') must not be read as a hedge")
  assert.ok(
    result.problems.some(p => /without hedging/i.test(p)),
    `expected an unhedged-mismatch problem, got: ${JSON.stringify(result.problems)}`
  )
})

test("checkValues does not misattribute a correct number for one service to a different retrieved service", () => {
  // Regression test: birthCert's real deadline is 30 days; dependentEnrollment's is
  // 365. A reply correctly stating "30 days" for birthCert, followed by a separate
  // block for dependentEnrollment with no day figure at all, must NOT be flagged —
  // this previously failed because the whole-reply scan attributed the "30 days"
  // (about birthCert) to dependentEnrollment's 365-day deadline.
  const reply = `**${birthCert.name}** — register within 30 days of birth (please confirm with RNPN).\n---\n**${dependentEnrollment.name}** — enroll your baby as a dependent once you have the birth certificate.`
  const result = checkValues(reply, [birthCert, dependentEnrollment])
  assert.equal(result.ok, true, JSON.stringify(result.problems))
})

test("checkValues does not demand a hedge for a number that matches a trusted structured field", () => {
  // Even for an unverified entry (its COST may be disputed), a number matching a
  // solid, structured KB field (deadlineDays) should NOT be flagged just because
  // the entry's overall status is needs_review.
  const reply = `**${unverifiedFixture.name}** — you must register within 30 days, no exceptions.`
  const result = checkValues(reply, [unverifiedFixture])
  assert.equal(result.ok, true, JSON.stringify(result.problems))
})

test("checkValues fails an unhedged figure that has no backing structured field", () => {
  // unverifiedFixture has no `amount` field at all — any dollar figure is only
  // explainable by unverified prose and must be hedged.
  const reply = `**${unverifiedFixture.name}** — the fee is $3.50, no exceptions.`
  const result = checkValues(reply, [unverifiedFixture])
  assert.equal(result.ok, false, "an unexplained figure on an unverified entry must be hedged, not asserted")
})

test("checkValues passes an unverified, unexplained figure when it IS hedged", () => {
  const reply = `**${unverifiedFixture.name}** — based on available info, the fee is about $3.50; please confirm with the agency.`
  const result = checkValues(reply, [unverifiedFixture])
  assert.equal(result.ok, true)
})

// ── Cost enforceability (Task 8) ────────────────────────────────────────
// A synthetic APPROVED fixture with no `amount` field — the exact shape that
// let the birth-reg "Free" bug through: high confidence, review="approved",
// but nothing structured to check a cost claim against.
const approvedNoAmountFixture = {
  ...birthCert,
  id: "test-approved-no-amount-fixture",
  name: "Test Approved No-Amount Service",
  nameEs: "Servicio de Prueba Aprobado Sin Monto",
  description: "A sample approved service with no structured amount, used only for grounding unit tests.",
  descriptionEs: "Un servicio de muestra aprobado sin monto estructurado, usado solo para pruebas de grounding.",
  universalTip: "Placeholder tip with no cost figure.",
  amount: undefined,
  costUncertain: false,
  confidence: 0.9,
  reviewStatus: "approved" as const,
}

test("checkValues fails an unhedged cost claim on an APPROVED entry with no amount field — never wrongly passes", () => {
  // This is the exact birth-reg "Free" bug: high confidence + approved must
  // NOT be treated as license to assert a cost nothing backs.
  const reply = `**${approvedNoAmountFixture.name}** — this is free, no cost at all.`
  const result = checkValues(reply, [approvedNoAmountFixture])
  assert.equal(result.ok, false, "an approved entry with no amount field must not let an unhedged cost claim through")
})

test("checkValues fails an unhedged dollar figure on an APPROVED entry with no amount field", () => {
  const reply = `**${approvedNoAmountFixture.name}** — the fee is $10, no exceptions.`
  const result = checkValues(reply, [approvedNoAmountFixture])
  assert.equal(result.ok, false, "an approved entry with no amount field must not let an unhedged dollar figure through")
})

test("checkValues passes a HEDGED cost claim on an approved entry with no amount field", () => {
  const reply = `**${approvedNoAmountFixture.name}** — based on available info, this appears to be free of charge; please confirm with the agency.`
  const result = checkValues(reply, [approvedNoAmountFixture])
  assert.equal(result.ok, true, JSON.stringify(result.problems))
})

test("checkValues fails a 'free' claim that contradicts a real structured amount", () => {
  // birthCert now has a real, non-free `amount` — asserting "free" is simply wrong.
  const reply = `**${birthCert.name}** — this is completely free of charge.`
  const result = checkValues(reply, [birthCert])
  assert.equal(result.ok, false, "a false 'free' claim must be caught even when phrased confidently")
})

test("checkValues fails a bare flat figure on a costUncertain (genuinely tiered) entry", () => {
  // birthCert is now costUncertain: true — stating one number as THE cost, unhedged, is misleading.
  const reply = `**${birthCert.name}** — the fee is $20, no exceptions.`
  const result = checkValues(reply, [birthCert])
  assert.equal(result.ok, false, "a costUncertain entry must not let a single flat figure through unhedged")
})

test("checkValues passes a tiered, hedged cost description on a costUncertain entry", () => {
  const reply = `**${birthCert.name}** — cost varies: about $3 to $5 domestically, $20 if you need it authenticated for use abroad.`
  const result = checkValues(reply, [birthCert])
  assert.equal(result.ok, true, JSON.stringify(result.problems))
})

// ── Full orchestrator: entity/value failures never need the LLM stage ───
test("check() short-circuits on entity failure — never wrongly SUPPORTED, no API key required", async () => {
  const reply = `Here's what you need: **${birthCert.name}** from RNPN. You also qualify for **${maternityBenefit.name}**.`
  const result = await check(reply, [birthCert], fullKB, { lifeEvents: ["new-baby"], employment: "unknown" })
  assert.equal(result.grounded, false)
  assert.equal(result.stage, "entity")
})

test("check() short-circuits on value failure — never wrongly SUPPORTED, no API key required", async () => {
  const reply = `**${dependentEnrollment.name}** — you must enroll within 30 days of birth.`
  const result = await check(reply, [dependentEnrollment], fullKB, { lifeEvents: ["new-baby"], employment: "formal" })
  assert.equal(result.grounded, false)
  assert.equal(result.stage, "value")
})

// ── Stage 3: faithfulness (LLM backstop) — requires OPENAI_API_KEY ───────
test("check() passes a genuinely grounded, accurate reply (approved entry, no hedge required)", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  // birthCert is now reviewStatus: "approved" with confidence 0.85 — its domestic
  // cost range ($3-$5) can be stated plainly, no hedge needed.
  const reply = `You need the ${birthCert.name}. For domestic use it costs about $3 to $5, depending on the municipality.`
  const result = await check(reply, [birthCert], fullKB, { lifeEvents: ["new-baby"], employment: "unknown" })
  assert.equal(result.grounded, true, JSON.stringify(result))
})

test("check() passes a genuinely grounded, hedged reply for a still-unverified fact", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  const reply = `You need the ${unverifiedFixture.name}. Based on available info, the cost is about $3.50 — please confirm the exact fee with the agency.`
  const result = await check(reply, [unverifiedFixture], fullKB, { lifeEvents: ["new-baby"], employment: "unknown" })
  assert.equal(result.grounded, true, JSON.stringify(result))
})

test("check() catches a context contradiction (the empathy-opener bug) — never wrongly SUPPORTED", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  const reply = `I'm sorry to hear about your job loss. Regarding the ${birthCert.name}, please confirm the fee with RNPN.`
  const result = await check(reply, [birthCert], fullKB, { lifeEvents: ["new-baby"], employment: "unknown" })
  assert.equal(result.grounded, false, "a reply contradicting the citizen's actual life event must never be approved")
  assert.equal(result.stage, "faithfulness")
})

// ── Fix R1: single-source facts payload (buildKBFacts) ──────────────────
// The recurring bug (Tasks 8, S1, A): a field existed in compactKB (what
// generation saw) but was missing from the judge's separately hand-maintained
// facts list, so the judge flagged correct replies as unsupported. Fixed by
// making both call sites use the SAME builder — these tests assert that
// structurally, not just via one-off symptom checks.

test("buildKBFacts is the single source — its output carries every field the judge needs, none re-listed by hand", () => {
  const facts = buildKBFacts([birthCert], "en")
  assert.equal(facts.length, 1)
  const f = facts[0]
  // The exact fields historically missing from the judge's hand list (Task A).
  for (const key of ["hours", "address", "siteNav", "verified", "docs", "amount", "deadline", "tip"]) {
    assert.ok(key in f, `buildKBFacts output must carry "${key}" — the judge derives its facts from this exact object`)
  }
})

test("check() does NOT flag a visit-prep reply citing hours/address/siteNav/verified — the Task-A bug", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  // Deliberately omits universalTip's own text — it legitimately contains the
  // word "free" in an unrelated clause ("Simple SV itself is free to use"),
  // which trips the deterministic (Task-8) free-claim check at the "value"
  // stage — a test-construction artifact, not something this test is about.
  const reply = `**${birthCert.name}**

**Before you go:**
- Hours: ${birthCert.officeHours}
- Address: ${birthCert.capitalAddress}
- Navigation: ${birthCert.siteNavigation}, as of ${birthCert.lastVerified}`
  const result = await check(reply, [birthCert], fullKB, { lifeEvents: ["new-baby"], employment: "unknown" })
  assert.equal(result.grounded, true, JSON.stringify(result))
})

test("check() does NOT flag a reply listing the retrieved service's documents — the Task-8 bug", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  const reply = `**${birthCert.name}** — Documents needed: ${birthCert.documents.join(", ")}.`
  const result = await check(reply, [birthCert], fullKB, { lifeEvents: ["new-baby"], employment: "unknown" })
  assert.equal(result.grounded, true, JSON.stringify(result))
})

test("check() builds Spanish facts for a Spanish reply — a Spanish document list isn't flagged as a language mismatch", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  const reply = `**${birthCert.nameEs}** — Documentos necesarios: ${birthCert.documentsEs.join(", ")}.`
  const result = await check(reply, [birthCert], fullKB, { lifeEvents: ["new-baby"], employment: "unknown" }, "es")
  assert.equal(result.grounded, true, JSON.stringify(result))
})

test("check() still catches a genuinely fabricated agency/number even with the expanded facts payload", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  const reply = `**${birthCert.name}** — you must also register with the Ministry of Labor, and the fee there is $200.`
  const result = await check(reply, [birthCert], fullKB, { lifeEvents: ["new-baby"], employment: "unknown" })
  assert.equal(result.grounded, false, "a fabricated agency/fee must still be caught after the refactor")
})
