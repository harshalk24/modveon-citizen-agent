import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

// Minimal .env.local loader — this test runs outside Next.js, which normally
// loads it automatically. Only fills vars not already set in the environment.
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

const { canWriteDurable, canWriteProfile, meetsIntentConfidence, canWriteLifeEvent, canWriteEmployment, canWriteMemoryType, CONFIDENCE_THRESHOLDS } = await import("../lib/confidence")
const { classifyQuery } = await import("../lib/classify-query")

const VALID_EMPLOYMENT = ["formal", "informal", "unemployed", "unknown"]
const VALID_MEMORY_TYPES = ["discard", "session", "episodic", "durable"]

// ── Gate threshold boundaries — deterministic, no network ──────────────
test("canWriteDurable rejects just below the durable-write threshold", () => {
  assert.equal(canWriteDurable({ confidence: CONFIDENCE_THRESHOLDS.durableWrite - 0.01 }), false)
})

test("canWriteDurable accepts at and above the durable-write threshold", () => {
  assert.equal(canWriteDurable({ confidence: CONFIDENCE_THRESHOLDS.durableWrite }), true)
  assert.equal(canWriteDurable({ confidence: 1.0 }), true)
})

test("canWriteProfile mirrors canWriteDurable", () => {
  assert.equal(canWriteProfile({ confidence: 0.5 }), canWriteDurable({ confidence: 0.5 }))
  assert.equal(canWriteProfile({ confidence: 0.95 }), canWriteDurable({ confidence: 0.95 }))
})

test("meetsIntentConfidence uses the lower intent threshold", () => {
  assert.equal(meetsIntentConfidence({ confidence: CONFIDENCE_THRESHOLDS.intent - 0.01 }), false)
  assert.equal(meetsIntentConfidence({ confidence: CONFIDENCE_THRESHOLDS.intent }), true)
})

test("canWriteLifeEvent / canWriteEmployment use their own per-facet thresholds", () => {
  assert.equal(canWriteLifeEvent({ lifeEventConfidence: CONFIDENCE_THRESHOLDS.lifeEvent - 0.01 }), false)
  assert.equal(canWriteLifeEvent({ lifeEventConfidence: CONFIDENCE_THRESHOLDS.lifeEvent }), true)
  assert.equal(canWriteEmployment({ employmentConfidence: CONFIDENCE_THRESHOLDS.employment - 0.01 }), false)
  assert.equal(canWriteEmployment({ employmentConfidence: CONFIDENCE_THRESHOLDS.employment }), true)
  // Missing facet confidence defaults to 0 — fails closed, doesn't throw.
  assert.equal(canWriteLifeEvent({}), false)
  assert.equal(canWriteEmployment({}), false)
})

test("canWriteMemoryType uses its own per-facet threshold and fails closed", () => {
  assert.equal(canWriteMemoryType({ memoryTypeConfidence: CONFIDENCE_THRESHOLDS.memoryType - 0.01 }), false)
  assert.equal(canWriteMemoryType({ memoryTypeConfidence: CONFIDENCE_THRESHOLDS.memoryType }), true)
  assert.equal(canWriteMemoryType({}), false)
})

test("fail-safe: a parse-failure-shaped confidence of 0 never clears any gate", () => {
  const failed = { confidence: 0 }
  assert.equal(canWriteDurable(failed), false)
  assert.equal(canWriteProfile(failed), false)
  assert.equal(meetsIntentConfidence(failed), false)
  assert.equal(canWriteMemoryType(failed), false)
})

// ── Live classifier shape checks — requires OPENAI_API_KEY ──────────────
const hasKey = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key"

test("classifyQuery returns a valid type and a numeric confidence in [0,1]", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  const samples: Array<{ message: string; hasLifeEvent: boolean; hasEntitlements: boolean; expect: string }> = [
    { message: "acabo de tener un bebé", hasLifeEvent: false, hasEntitlements: false, expect: "service-lookup" },
    { message: "what's the weather today?", hasLifeEvent: false, hasEntitlements: false, expect: "out-of-scope" },
    { message: "what else can I apply for?", hasLifeEvent: true, hasEntitlements: true, expect: "open-ended" },
  ]

  for (const s of samples) {
    const result = await classifyQuery({
      message: s.message,
      hasLifeEvent: s.hasLifeEvent,
      hasEntitlements: s.hasEntitlements,
      conversationHistory: "",
    })
    assert.equal(typeof result.confidence, "number")
    assert.ok(result.confidence >= 0 && result.confidence <= 1, `confidence ${result.confidence} out of range`)
    assert.equal(result.type, s.expect, `message "${s.message}" expected ${s.expect}, got ${result.type}`)
  }
})

// ── Task 3: lifeEvent/employment facets — messages 1, 3, 4, 5 from the test table ─
test("classifyQuery returns lifeEvent/employment facets with the new vocabulary", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  const samples: Array<{ message: string; expectLifeEvent?: string; expectEmployment?: string }> = [
    { message: "I just had a baby", expectLifeEvent: "new-baby" },
    { message: "I have a formal job with a contract", expectEmployment: "formal" },
    { message: "I sell food on the street, no contract", expectEmployment: "informal" },
    { message: "I lost my job", expectLifeEvent: "job-loss", expectEmployment: "unemployed" },
  ]

  for (const s of samples) {
    const result = await classifyQuery({
      message: s.message,
      hasLifeEvent: false,
      hasEntitlements: false,
      conversationHistory: "",
    })

    assert.equal(typeof result.lifeEventConfidence, "number")
    assert.ok(result.lifeEventConfidence >= 0 && result.lifeEventConfidence <= 1)
    assert.equal(typeof result.employmentConfidence, "number")
    assert.ok(result.employmentConfidence >= 0 && result.employmentConfidence <= 1)

    // Employment is always one of the new four values — "employed" must never appear.
    assert.ok(VALID_EMPLOYMENT.includes(result.employment), `employment "${result.employment}" not in ${VALID_EMPLOYMENT}`)
    assert.notEqual(result.employment as string, "employed")

    if (s.expectLifeEvent) {
      assert.equal(result.lifeEvent, s.expectLifeEvent, `message "${s.message}" expected lifeEvent ${s.expectLifeEvent}, got ${result.lifeEvent}`)
    }
    if (s.expectEmployment) {
      assert.equal(result.employment, s.expectEmployment, `message "${s.message}" expected employment ${s.expectEmployment}, got ${result.employment}`)
    }
  }
})

// ── Task 4: memoryType facet — messages 1-5 from the test table ────────
test("classifyQuery distinguishes durable facts, episodic events, session questions, and discard", { skip: !hasKey && "OPENAI_API_KEY not set" }, async () => {
  const samples: Array<{ message: string; hasLifeEvent?: boolean; expectMemoryType: string }> = [
    { message: "Hi, good afternoon", expectMemoryType: "discard" },
    { message: "I work at a formal company", expectMemoryType: "durable" },
    { message: "I registered the birth yesterday", expectMemoryType: "episodic" },
    { message: "Tell me more about the maternity benefit", hasLifeEvent: true, expectMemoryType: "session" },
    { message: "Who won the World Cup?", expectMemoryType: "discard" },
  ]

  for (const s of samples) {
    const result = await classifyQuery({
      message: s.message,
      hasLifeEvent: s.hasLifeEvent ?? false,
      hasEntitlements: false,
      conversationHistory: "",
    })

    assert.ok(VALID_MEMORY_TYPES.includes(result.memoryType), `memoryType "${result.memoryType}" not in ${VALID_MEMORY_TYPES}`)
    assert.equal(typeof result.memoryTypeConfidence, "number")
    assert.ok(result.memoryTypeConfidence >= 0 && result.memoryTypeConfidence <= 1)
    assert.equal(result.memoryType, s.expectMemoryType, `message "${s.message}" expected memoryType ${s.expectMemoryType}, got ${result.memoryType}`)
  }
})
