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

const { canWriteDurable, canWriteProfile, meetsIntentConfidence, CONFIDENCE_THRESHOLDS } = await import("../lib/confidence")
const { classifyQuery } = await import("../lib/classify-query")

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

test("fail-safe: a parse-failure-shaped confidence of 0 never clears any gate", () => {
  const failed = { confidence: 0 }
  assert.equal(canWriteDurable(failed), false)
  assert.equal(canWriteProfile(failed), false)
  assert.equal(meetsIntentConfidence(failed), false)
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
