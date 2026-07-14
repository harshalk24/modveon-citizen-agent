import { test } from "node:test"
import assert from "node:assert/strict"

const { looksHypothetical, extractRemoveSituation } = await import("../lib/extract-intent")

// ── looksHypothetical: deterministic backstop for the situation-add gate ──
test("looksHypothetical recognizes the exact phrasing that misfires through the LLM classifier", () => {
  assert.equal(looksHypothetical("What if I lost my job?"), true)
  assert.equal(looksHypothetical("What if I move abroad?"), true)
})

test("looksHypothetical recognizes other common hypothetical/conditional framings (EN)", () => {
  assert.equal(looksHypothetical("Can I start a business?"), true)
  assert.equal(looksHypothetical("Could I get a home loan?"), true)
  assert.equal(looksHypothetical("Should I register my business?"), true)
  assert.equal(looksHypothetical("If I'm unemployed can I still apply?"), true)
  assert.equal(looksHypothetical("Am I allowed to work informally?"), true)
})

test("looksHypothetical recognizes Spanish hypothetical/conditional framings", () => {
  assert.equal(looksHypothetical("¿Qué pasa si pierdo mi trabajo?"), true)
  assert.equal(looksHypothetical("¿Puedo registrar un negocio?"), true)
  assert.equal(looksHypothetical("¿Podría aplicar si soy informal?"), true)
})

test("looksHypothetical returns false for a real declaration", () => {
  assert.equal(looksHypothetical("I lost my job"), false)
  assert.equal(looksHypothetical("I just had a baby"), false)
  assert.equal(looksHypothetical("I want to register my business"), false)
  assert.equal(looksHypothetical("Perdí mi trabajo"), false)
})

test("looksHypothetical returns false for an unrelated follow-up question", () => {
  assert.equal(looksHypothetical("What documents do I need?"), false)
  assert.equal(looksHypothetical("How long does it take?"), false)
})

// ── extractRemoveSituation: Phase 2a Step 6 safety valve ────────────────
test("extractRemoveSituation matches an explicit removal naming an active situation", () => {
  assert.equal(extractRemoveSituation("remove job loss", ["new-baby", "job-loss"]), "job-loss")
  assert.equal(extractRemoveSituation("please remove the new baby situation", ["new-baby", "job-loss"]), "new-baby")
})

test("extractRemoveSituation matches Spanish removal phrasing", () => {
  assert.equal(extractRemoveSituation("quitar pérdida de empleo", ["new-baby", "job-loss"]), "job-loss")
  assert.equal(extractRemoveSituation("ya no tengo pérdida de empleo", ["new-baby", "job-loss"]), "job-loss")
})

test("extractRemoveSituation returns null without an explicit removal verb", () => {
  assert.equal(extractRemoveSituation("I found a job", ["new-baby", "job-loss"]), null)
  assert.equal(extractRemoveSituation("job loss is hard", ["new-baby", "job-loss"]), null)
})

test("extractRemoveSituation returns null when no active situation is named", () => {
  assert.equal(extractRemoveSituation("remove my account", ["new-baby", "job-loss"]), null)
})

test("extractRemoveSituation returns null when the named situation isn't actually active", () => {
  assert.equal(extractRemoveSituation("remove job loss", ["new-baby"]), null)
})
