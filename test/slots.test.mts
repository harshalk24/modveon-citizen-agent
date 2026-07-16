import { test } from "node:test"
import assert from "node:assert/strict"

const { SLOT_DEFS, applySlotInferences, nextMissingSlot } = await import("../lib/slots")
const {
  extractBusinessSizeTier, extractPoderPurpose, extractBirthRegistered,
} = await import("../lib/slot-extract")
const { services: fullKB, lookupServices } = await import("../lib/kb")

// ── Slot extraction (deterministic keyword matching) ────────────────────
test("extractBusinessSizeTier recognizes a solo vendor via proxy phrasing", () => {
  assert.equal(extractBusinessSizeTier("just me, small stall"), "solo")
  assert.equal(extractBusinessSizeTier("it's only me, no employees"), "solo")
})

test("extractBusinessSizeTier recognizes storefront and employees tiers", () => {
  assert.equal(extractBusinessSizeTier("I have a storefront"), "storefront")
  assert.equal(extractBusinessSizeTier("I have 3 employees"), "employees")
})

test("extractBusinessSizeTier returns null on an unrelated/ambiguous reply — never guesses", () => {
  assert.equal(extractBusinessSizeTier("what documents do I need?"), null)
})

test("extractPoderPurpose distinguishes judicial from property/general", () => {
  assert.equal(extractPoderPurpose("it's for a custody case in court"), "judicial")
  assert.equal(extractPoderPurpose("I need to sell my parents' house"), "property")
})

test("extractBirthRegistered reads a plain yes/no", () => {
  assert.equal(extractBirthRegistered("yes, already did that"), "yes")
  assert.equal(extractBirthRegistered("not yet"), "no")
  assert.equal(extractBirthRegistered("tell me more about ISSS"), null)
})

// ── nextMissingSlot: critical-before-refining, one at a time ─────────────
test("nextMissingSlot returns the CRITICAL slot first even if refining slots are also missing", () => {
  const slot = nextMissingSlot("start-business", {})
  assert.equal(slot?.key, "businessSizeTier")
  assert.equal(slot?.critical, true)
})

test("nextMissingSlot falls through to a refining slot once critical ones are known", () => {
  const slot = nextMissingSlot("start-business", { businessSizeTier: "solo", hasEmployees: "no" })
  assert.equal(slot?.key, "alreadyRegistered")
  assert.equal(slot?.critical, false)
})

test("nextMissingSlot returns null when nothing is missing — never asks a spurious question", () => {
  const slot = nextMissingSlot("start-business", { businessSizeTier: "solo", hasEmployees: "no", alreadyRegistered: "no" })
  assert.equal(slot, null)
})

test("nextMissingSlot returns null for a lifeEvent with no slot definitions", () => {
  // Task 2b eligibility FILTER added a job-loss slot (wasFormallyEmployed),
  // so job-loss no longer illustrates "no slot definitions" — marriage still
  // has none.
  assert.equal(nextMissingSlot("marriage", {}), null)
})

// ── applySlotInferences: don't ask what's already inferable ──────────────
test("applySlotInferences derives hasEmployees=no from businessSizeTier=solo — never asks it separately", () => {
  const slots = applySlotInferences("start-business", { businessSizeTier: "solo" })
  assert.equal(slots.hasEmployees, "no")
  const nextSlot = nextMissingSlot("start-business", slots)
  assert.notEqual(nextSlot?.key, "hasEmployees")
})

test("applySlotInferences derives hasEmployees=yes from businessSizeTier=employees", () => {
  const slots = applySlotInferences("start-business", { businessSizeTier: "employees" })
  assert.equal(slots.hasEmployees, "yes")
})

test("applySlotInferences leaves hasEmployees genuinely unknown for the ambiguous 'storefront' tier", () => {
  const slots = applySlotInferences("start-business", { businessSizeTier: "storefront" })
  assert.equal(slots.hasEmployees, undefined, "storefront tier is genuinely ambiguous — hasEmployees must stay unknown, not guessed")
  // alreadyRegistered is still missing too and comes first in SLOT_DEFS order,
  // so it's the one asked next — but hasEmployees remains genuinely open,
  // not silently resolved, and will be asked once alreadyRegistered is answered.
  const afterAlreadyRegistered = nextMissingSlot("start-business", { ...slots, alreadyRegistered: "no" })
  assert.equal(afterAlreadyRegistered?.key, "hasEmployees")
})

// ── lookupServices: slot-based suppression (retrieval personalization) ───
test("lookupServices suppresses Matrícula/CNR for a confirmed solo vendor", () => {
  const withoutSlot = lookupServices({ country: "SV", lifeEvent: "start-business", employment: "informal" })
  assert.ok(withoutSlot.some(s => s.id === "sv-cnr-business-registration"), "sanity check: CNR is normally retrieved")

  const withSoloSlot = lookupServices({ country: "SV", lifeEvent: "start-business", employment: "informal", slots: { businessSizeTier: "solo" } })
  assert.ok(!withSoloSlot.some(s => s.id === "sv-cnr-business-registration"), "a confirmed solo vendor must NOT be shown Matrícula de Empresa")
})

test("lookupServices still surfaces Matrícula/CNR for a storefront/employees tier", () => {
  const results = lookupServices({ country: "SV", lifeEvent: "start-business", employment: "informal", slots: { businessSizeTier: "employees" } })
  assert.ok(results.some(s => s.id === "sv-cnr-business-registration"))
})

test("lookupServices is unaffected when no slots are known at all", () => {
  const results = lookupServices({ country: "SV", lifeEvent: "start-business", employment: "informal" })
  assert.ok(results.some(s => s.id === "sv-cnr-business-registration"))
})

// ── Sanity: slot defs reference real, defined ask text in both languages ──
test("every SLOT_DEF has both EN and ES ask text and a working extractor", () => {
  for (const [lifeEvent, defs] of Object.entries(SLOT_DEFS)) {
    for (const def of defs) {
      assert.ok(def.ask.en.length > 0, `${lifeEvent}.${def.key} missing EN ask text`)
      assert.ok(def.ask.es.length > 0, `${lifeEvent}.${def.key} missing ES ask text`)
      assert.equal(typeof def.extract, "function", `${lifeEvent}.${def.key} missing extractor`)
    }
  }
})
