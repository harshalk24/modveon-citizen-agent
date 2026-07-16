import { test } from "node:test"
import assert from "node:assert/strict"

// Task GENDER_ELIGIBILITY — the gender × employment matrix for the two gated
// new-baby ISSS benefits, exercised through the REAL KB entries + lookupServices
// (the backdrop retrieval path the chat route uses). Pure/deterministic — no
// network, no LLM, no embedding — so it runs in the plain test suite.
const { lookupServices, isEligible, services } = await import("../lib/kb")

const maternity = services.find(s => s.id === "sv-isss-maternity-benefit")!
const paternity = services.find(s => s.id === "sv-isss-paternity-benefit")!

// Sanity: the tags landed (guards against a future edit dropping appliesTo).
test("gender tags: maternity=mother, paternity=father", () => {
  assert.equal(maternity.eligibility?.appliesTo, "mother")
  assert.equal(paternity.eligibility?.appliesTo, "father")
})

// isEligible(service, employment, gender, slots)
function shown(svcId: string, employment: string, gender?: string): boolean {
  const list = lookupServices({ country: "SV", lifeEvent: "new-baby", employment, gender })
  return list.some(s => s.id === svcId)
}

const M = "sv-isss-maternity-benefit"
const P = "sv-isss-paternity-benefit"

// | gender | employment | Maternity | Paternity |
const matrix: Array<{ gender: string | undefined; employment: string; maternity: boolean; paternity: boolean; why: string }> = [
  { gender: "male",      employment: "formal",     maternity: false, paternity: true,  why: "male: paternity yes (formal), maternity suppressed — the reported bug" },
  { gender: "male",      employment: "informal",   maternity: false, paternity: false, why: "male informal: maternity gender-suppressed, paternity employment-suppressed (current_formal)" },
  { gender: "female",    employment: "formal",     maternity: true,  paternity: false, why: "female formal: maternity yes, paternity gender-suppressed" },
  { gender: "female",    employment: "informal",   maternity: true,  paternity: false, why: "female informal: maternity via prior_formal_ok (unknown slot => fail-open), paternity suppressed" },
  { gender: undefined,   employment: "formal",     maternity: true,  paternity: true,  why: "unset gender: fail-open, both shown" },
  { gender: "other",     employment: "formal",     maternity: true,  paternity: true,  why: "non-binary/other => unknown => fail-open, both shown" },
  { gender: "no-say",    employment: "formal",     maternity: true,  paternity: true,  why: "prefer-not-to-say => unknown => fail-open" },
]

for (const row of matrix) {
  test(`matrix: gender=${row.gender ?? "unset"} employment=${row.employment} — ${row.why}`, () => {
    assert.equal(shown(M, row.employment, row.gender), row.maternity, "maternity")
    assert.equal(shown(P, row.employment, row.gender), row.paternity, "paternity")
  })
}

// Gender gate is orthogonal to employment: a known-female never sees paternity
// regardless of employment, a known-male never sees maternity regardless of it.
test("gender gate short-circuits before employment (opposite-gender always suppressed)", () => {
  for (const emp of ["formal", "informal", "unemployed", "unknown", "any"]) {
    assert.equal(isEligible(paternity, emp, "female"), false, `paternity hidden from female @ ${emp}`)
    assert.equal(isEligible(maternity, emp, "male"), false, `maternity hidden from male @ ${emp}`)
  }
})

// Ungated new-baby entries (birth cert, newborn canastilla) never gender-suppress.
test("ungated new-baby entries show for either known gender", () => {
  const birthCert = services.find(s => s.id === "sv-rnpn-birth-registration")!
  assert.equal(isEligible(birthCert, "formal", "male"), true)
  assert.equal(isEligible(birthCert, "formal", "female"), true)
})
