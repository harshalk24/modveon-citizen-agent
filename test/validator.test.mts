import { test } from "node:test"
import assert from "node:assert/strict"

const { checkKBLinks } = await import("../lib/validator")

// Mock fetch — deterministic, no real network calls.
//   statusByUrl: URL -> HTTP status to return
//   errorByUrl:  URL -> simulated failure kind ("dns" | "timeout" | "network")
// A URL present in neither map throws a "test not configured" error so a
// missing mock entry fails loudly instead of silently matching "network".
function mockFetch(config: { statusByUrl?: Record<string, number>; errorByUrl?: Record<string, "dns" | "timeout" | "network"> }) {
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string) => {
    const errKind = config.errorByUrl?.[url]
    if (errKind === "dns") {
      const err: any = new TypeError("fetch failed")
      err.cause = { code: "ENOTFOUND", message: `getaddrinfo ENOTFOUND ${url}` }
      throw err
    }
    if (errKind === "timeout") {
      const err: any = new Error("The operation was aborted due to timeout")
      err.name = "TimeoutError"
      throw err
    }
    if (errKind === "network") {
      const err: any = new TypeError("fetch failed")
      err.cause = { code: "ECONNRESET", message: "socket hang up" }
      throw err
    }
    const status = config.statusByUrl?.[url]
    if (status === undefined) throw new Error(`test not configured for ${url}`)
    return { status } as Response
  }) as typeof fetch
  return () => { globalThis.fetch = original }
}

function makeService(overrides: Partial<any> = {}): any {
  return {
    id: "test-service", country: "SV", lifeEvents: ["new-baby"], employment: ["any"],
    name: "Test Service", nameEs: "Servicio de Prueba", agency: "Test Agency", agencyFull: "Test Agency Full",
    description: "d", descriptionEs: "d", priority: 1, phaseToApply: 1,
    documents: [], documentsEs: [], sourceUrl: "https://example.com/info", lastVerified: "2026-01-01",
    ...overrides,
  }
}

// ── Three-state classification (the core of this fix) ───────────────────
test("checkKBLinks classifies a live 200 URL as OK — not reported in either bucket", async () => {
  const svc = makeService({ id: "svc-ok", sourceUrl: "https://example.com/live" })
  const restore = mockFetch({ statusByUrl: { "https://example.com/live": 200 } })
  try {
    const report = await checkKBLinks([svc])
    assert.equal(report.dead.length, 0)
    assert.equal(report.inconclusive.length, 0)
    assert.equal(report.okCount, 1)
  } finally { restore() }
})

test("checkKBLinks classifies a 404 as DEAD — the only real alarm state", async () => {
  const svc = makeService({ id: "svc-404", sourceUrl: "https://example.com/gone" })
  const restore = mockFetch({ statusByUrl: { "https://example.com/gone": 404 } })
  try {
    const report = await checkKBLinks([svc])
    assert.equal(report.dead.length, 1)
    assert.equal(report.dead[0].serviceId, "svc-404")
    assert.equal(report.inconclusive.length, 0)
  } finally { restore() }
})

test("checkKBLinks classifies a 410 as DEAD", async () => {
  const svc = makeService({ id: "svc-410", sourceUrl: "https://example.com/gone-forever" })
  const restore = mockFetch({ statusByUrl: { "https://example.com/gone-forever": 410 } })
  try {
    const report = await checkKBLinks([svc])
    assert.equal(report.dead.length, 1)
    assert.equal(report.dead[0].status, 410)
  } finally { restore() }
})

test("checkKBLinks classifies a 403 as INCONCLUSIVE, never DEAD — this is the Batch-B false-positive fix", async () => {
  const svc = makeService({ id: "svc-403", sourceUrl: "https://example.com/blocked" })
  const restore = mockFetch({ statusByUrl: { "https://example.com/blocked": 403 } })
  try {
    const report = await checkKBLinks([svc])
    assert.equal(report.dead.length, 0, "a WAF 403 must never be reported as a dead page")
    assert.equal(report.inconclusive.length, 1)
    assert.equal(report.inconclusive[0].status, 403)
    assert.match(report.inconclusive[0].reason, /not evidence the page is dead/)
  } finally { restore() }
})

test("checkKBLinks classifies 405 and 429 as INCONCLUSIVE too", async () => {
  const svc405 = makeService({ id: "svc-405", sourceUrl: "https://example.com/method-blocked" })
  const restore1 = mockFetch({ statusByUrl: { "https://example.com/method-blocked": 405 } })
  try {
    const report = await checkKBLinks([svc405])
    assert.equal(report.dead.length, 0)
    assert.equal(report.inconclusive.length, 1)
  } finally { restore1() }

  const svc429 = makeService({ id: "svc-429", sourceUrl: "https://example.com/rate-limited" })
  const restore2 = mockFetch({ statusByUrl: { "https://example.com/rate-limited": 429 } })
  try {
    const report = await checkKBLinks([svc429])
    assert.equal(report.dead.length, 0)
    assert.equal(report.inconclusive.length, 1)
  } finally { restore2() }
})

test("checkKBLinks classifies a genuine DNS failure as DEAD — the domain itself doesn't resolve", async () => {
  const svc = makeService({ id: "svc-dns-fail", sourceUrl: "https://this-domain-does-not-exist.invalid" })
  const restore = mockFetch({ errorByUrl: { "https://this-domain-does-not-exist.invalid": "dns" } })
  try {
    const report = await checkKBLinks([svc])
    assert.equal(report.dead.length, 1)
    assert.equal(report.dead[0].status, 0)
    assert.match(report.dead[0].reason, /DNS/i)
  } finally { restore() }
})

test("checkKBLinks classifies a timeout as INCONCLUSIVE, not DEAD — the checker rejecting HEAD was the original bug", async () => {
  const svc = makeService({ id: "svc-timeout", sourceUrl: "https://example.com/slow" })
  const restore = mockFetch({ errorByUrl: { "https://example.com/slow": "timeout" } })
  try {
    const report = await checkKBLinks([svc])
    assert.equal(report.dead.length, 0, "a timeout must never be reported as dead")
    assert.equal(report.inconclusive.length, 1)
    assert.match(report.inconclusive[0].reason, /timed out/i)
  } finally { restore() }
})

test("checkKBLinks classifies a generic network error as INCONCLUSIVE, not DEAD", async () => {
  const svc = makeService({ id: "svc-network-error", sourceUrl: "https://example.com/reset" })
  const restore = mockFetch({ errorByUrl: { "https://example.com/reset": "network" } })
  try {
    const report = await checkKBLinks([svc])
    assert.equal(report.dead.length, 0)
    assert.equal(report.inconclusive.length, 1)
  } finally { restore() }
})

// ── applyUrl checking (carried over from Batch B) ────────────────────────
test("checkKBLinks reports a dead applyUrl, naming the entry and the field", async () => {
  const svc = makeService({
    id: "svc-dead-apply",
    sourceUrl: "https://example.com/info",
    steps: ["step 1"], // presence of steps makes applyUrl derive to sourceUrl's value (no separate field exists)
  })
  const restore = mockFetch({ statusByUrl: { "https://example.com/info": 404 } })
  try {
    const report = await checkKBLinks([svc])
    const applyResult = report.dead.find(r => r.field === "applyUrl")
    assert.ok(applyResult, "a dead applyUrl (steps present) must be reported")
    assert.equal(applyResult?.serviceId, "svc-dead-apply")
  } finally { restore() }
})

test("checkKBLinks does NOT report a missing applyUrl for an informational-only entry — absence is not a dead link", async () => {
  const svc = makeService({ id: "svc-no-steps", sourceUrl: "https://example.com/info-only" })
  const restore = mockFetch({ statusByUrl: { "https://example.com/info-only": 200 } })
  try {
    const report = await checkKBLinks([svc])
    assert.equal(report.dead.length, 0)
    assert.equal(report.inconclusive.length, 0)
    assert.equal(report.okCount, 1, "only sourceUrl should have been checked at all")
  } finally { restore() }
})

test("checkKBLinks reports nothing when both sourceUrl and applyUrl are live", async () => {
  const svc = makeService({ id: "svc-all-live", sourceUrl: "https://example.com/live2", steps: ["step 1"] })
  const restore = mockFetch({ statusByUrl: { "https://example.com/live2": 200 } })
  try {
    const report = await checkKBLinks([svc])
    assert.equal(report.dead.length, 0)
    assert.equal(report.inconclusive.length, 0)
  } finally { restore() }
})
