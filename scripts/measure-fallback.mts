// TASK_FALLBACK_RATE_MEASUREMENT — one-time diagnostic, NOT a fix. Replicates
// the real per-turn pipeline (classifyQuery -> retrieveServices ->
// buildSystemPrompt -> generate -> checkGrounding, with the same one-shot
// regeneration route.ts does) against a realistic, majority-single-situation
// query spread, K=5 times per query, and reports the grounding OUTCOME
// distribution + rejection-reason frequency. No DB writes, no grounding/
// generation code changes — measurement only.
//
// Run: npx tsx scripts/measure-fallback.mts [--smoke]
// --smoke runs a tiny 2-query x 1-run subset to sanity-check the wiring
// before spending on the full ~150-run measurement.
import fs from "node:fs"
import path from "node:path"

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

import { classifyQuery } from "../lib/classify-query"
import { canWriteLifeEvent } from "../lib/confidence"
import { getActiveSituations } from "../lib/situations"
import { retrieveServices } from "../lib/semantic-search"
import { buildSystemPrompt, stripInvalidApplyNowTags } from "../lib/context-builder"
import { check as checkGrounding } from "../lib/grounding"
import { services as fullKB } from "../lib/kb"
import { getLLM } from "../lib/llm"
import { nextMissingSlot } from "../lib/slots"
import { CitizenContextData } from "../types/context"

const LANG = "en" as const

interface Persona {
  key: string
  situations: string[]
  primaryLifeEvent: string
  employment: "formal" | "informal" | "unemployed" | "unknown"
}

const PERSONAS: Record<string, Persona> = {
  newBaby:     { key: "newBaby",     situations: ["new-baby"],                     employment: "formal",     primaryLifeEvent: "new-baby" },
  business:    { key: "business",    situations: ["start-business"],              employment: "informal",   primaryLifeEvent: "start-business" },
  diaspora:    { key: "diaspora",    situations: ["diaspora"],                     employment: "unknown",    primaryLifeEvent: "diaspora" },
  jobLoss:     { key: "jobLoss",     situations: ["job-loss"],                     employment: "unemployed", primaryLifeEvent: "job-loss" },
  babyJobLoss: { key: "babyJobLoss", situations: ["new-baby", "job-loss"],         employment: "unemployed", primaryLifeEvent: "job-loss" },
  bizJobLoss:  { key: "bizJobLoss",  situations: ["start-business", "job-loss"],   employment: "unemployed", primaryLifeEvent: "job-loss" },
  babyBiz:     { key: "babyBiz",     situations: ["new-baby", "start-business"],   employment: "informal",   primaryLifeEvent: "start-business" },
}

interface QuerySpec {
  category: "single-specific" | "single-followup" | "single-general" | "multi-specific" | "multi-general"
  persona: string
  query: string
  priorTurn?: { q: string; a: string }
}

const QUERIES: QuerySpec[] = [
  // single-situation, specific (~50%)
  { category: "single-specific", persona: "newBaby",  query: "how much does the birth certificate cost?" },
  { category: "single-specific", persona: "newBaby",  query: "what benefits are there for my baby?" },
  { category: "single-specific", persona: "newBaby",  query: "how do I add my baby to ISSS?" },
  { category: "single-specific", persona: "newBaby",  query: "when do I need to register my baby's birth?" },
  { category: "single-specific", persona: "business", query: "how do I register my business?" },
  { category: "single-specific", persona: "business", query: "is there a grant to start a business?" },
  { category: "single-specific", persona: "business", query: "do I need a license for my shop?" },
  { category: "single-specific", persona: "business", query: "how much does it cost to register a business?" },
  { category: "single-specific", persona: "diaspora", query: "how do I get a power of attorney from the US?" },
  { category: "single-specific", persona: "diaspora", query: "how do I authenticate a document?" },
  { category: "single-specific", persona: "diaspora", query: "can a US notary handle my poder notarial?" },
  { category: "single-specific", persona: "jobLoss",  query: "do I get any support if I lost my job?" },
  { category: "single-specific", persona: "jobLoss",  query: "is there free job training available?" },
  { category: "single-specific", persona: "jobLoss",  query: "how do I get the unemployment support?" },

  // single-situation, follow-ups (~15%)
  { category: "single-followup", persona: "newBaby",  query: "what documents do I need?",
    priorTurn: { q: "what benefits are there for my baby?", a: "You qualify for the ISSS newborn canastilla and lactancia support, and you'll need to register the birth with RNPN within 30 days." } },
  { category: "single-followup", persona: "business", query: "how long does it take?",
    priorTurn: { q: "how do I register my business?", a: "You'd register your Matrícula de Empresa with the CNR and get a NIT from Hacienda." } },
  { category: "single-followup", persona: "diaspora", query: "how much does it cost?",
    priorTurn: { q: "how do I get a power of attorney from the US?", a: "You can get a poder notarial through a Salvadoran consulate or an authorized notary." } },
  { category: "single-followup", persona: "jobLoss",  query: "what documents do I need?",
    priorTurn: { q: "do I get any support if I lost my job?", a: "You may qualify for INSAFORP free job training and other unemployment support." } },

  // single-situation, general (~10%)
  { category: "single-general", persona: "newBaby",  query: "what am I eligible for?" },
  { category: "single-general", persona: "business", query: "what am I eligible for?" },
  { category: "single-general", persona: "jobLoss",  query: "what am I eligible for?" },

  // multi-situation, specific (~15%)
  { category: "multi-specific", persona: "babyJobLoss", query: "what benefits are there for my baby?" },
  { category: "multi-specific", persona: "bizJobLoss",  query: "how do I register my business?" },
  { category: "multi-specific", persona: "babyJobLoss", query: "is there free job training available?" },
  { category: "multi-specific", persona: "bizJobLoss",  query: "is there a grant to start a business?" },

  // multi-situation, general (~10%)
  { category: "multi-general", persona: "babyJobLoss", query: "what am I eligible for?" },
  { category: "multi-general", persona: "bizJobLoss",  query: "what am I eligible for?" },
  { category: "multi-general", persona: "babyBiz",     query: "what am I eligible for?" },
]

const K = 5

function makeCtx(persona: Persona): CitizenContextData {
  return {
    citizenId: "measure-" + persona.key,
    profile: {
      firstName: "Test",
      country: "SV",
      employment: persona.employment,
      lifeEvent: persona.primaryLifeEvent,
      activeLifeEvents: JSON.stringify(persona.situations),
      language: LANG,
    },
    slots: {},
    entitlements: [],
    planSteps: [],
    deadlines: [],
    lastUpdated: new Date().toISOString(),
  }
}

async function generateFull(systemPrompt: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const stream = getLLM().streamChat(systemPrompt, messages, { temperature: 0.3, maxTokens: 600 })
  const parts: string[] = []
  for await (const chunk of stream) parts.push(chunk)
  return parts.join("")
}

// The first full run hit OpenAI 429s on ~70% of turns (concurrency=6 against
// a 200K TPM cap, each turn's system prompt carrying the full KB payload) —
// that's an infra-throttling failure, not a grounding signal, and it
// invalidated that run. Retry with the API's own suggested backoff (falls
// back to a fixed 2s) so a rate-limit blip doesn't get misrecorded as
// anything meaningful.
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 6): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const msg = String(err?.message || err)
      if (!/429|rate limit/i.test(msg)) throw err
      const waitMatch = msg.match(/try again in ([\d.]+)(ms|s)/)
      const waitMs = waitMatch ? (waitMatch[2] === "s" ? parseFloat(waitMatch[1]) * 1000 : parseFloat(waitMatch[1])) : 2000
      await new Promise(r => setTimeout(r, waitMs + 500))
    }
  }
  throw lastErr
}

interface RunRecord {
  query: string
  category: QuerySpec["category"]
  persona: string
  situations: string[]
  runIndex: number
  outcome: "passed-first-try" | "passed-on-retry" | "fell-back" | "no-check-needed" | "error"
  // TASK_RETRY_RATE_DIAGNOSIS additions:
  retried: boolean // did the 1st draft fail grounding and trigger a regenerate?
  firstDraftRejectReasons: string[] // WHY attempt 1 specifically was rejected — kept
  // separate from `rejectionReasons` below, which combines both attempts on a
  // fell-back (that field answers "what did the citizen almost see wrong,"
  // this one answers "why did the FIRST draft specifically get rejected").
  rejectionReasons: string[]
  errorMessage?: string
}

async function runOnce(spec: QuerySpec, runIndex: number): Promise<RunRecord> {
  const persona = PERSONAS[spec.persona]
  const ctx = makeCtx(persona)
  const activeSituations = getActiveSituations(ctx.profile)
  const base: Pick<RunRecord, "query" | "category" | "persona" | "situations" | "runIndex"> = {
    query: spec.query, category: spec.category, persona: spec.persona, situations: activeSituations, runIndex,
  }

  try {
    const conversationHistory = spec.priorTurn ? `User: ${spec.priorTurn.q}\nAssistant: ${spec.priorTurn.a}` : ""
    const classification = await withRetry(() => classifyQuery({
      message: spec.query,
      hasLifeEvent: activeSituations.length > 0,
      hasEntitlements: false,
      conversationHistory,
      activeSituations,
    }))

    const detectedEvent = classification.lifeEvent
    const classifierTargetSlug = (detectedEvent && activeSituations.includes(detectedEvent) && canWriteLifeEvent(classification))
      ? detectedEvent
      : null

    const retrieval = await withRetry(() => retrieveServices({
      country: "SV",
      lifeEvents: activeSituations,
      employment: persona.employment,
      slots: {},
      query: spec.query,
      queryType: classification.type,
      lang: LANG,
    }))
    const svcs = retrieval.services

    // Same Bug A fix as app/api/chat/route.ts: "open-ended" never lets the
    // foreground fallback set a target.
    let askTargetSlug: string | null = classifierTargetSlug
    if (!askTargetSlug && classification.type !== "open-ended") {
      const topForeground = svcs.find(s => s._source === "foreground" || s._source === "both")
      askTargetSlug = topForeground?._situations?.find(s => activeSituations.includes(s)) || null
    }

    const slotToAsk = askTargetSlug ? nextMissingSlot(askTargetSlug, {}) : null

    const recentMsgsGemini = spec.priorTurn
      ? [{ role: "user" as const, parts: spec.priorTurn.q }, { role: "model" as const, parts: spec.priorTurn.a }, { role: "user" as const, parts: spec.query }]
      : [{ role: "user" as const, parts: spec.query }]

    const systemPrompt = buildSystemPrompt(ctx, svcs, JSON.stringify(recentMsgsGemini), LANG, classification.type, slotToAsk, retrieval.isHonestMiss, askTargetSlug)
    const messages = recentMsgsGemini.map(m => ({ role: m.role === "model" ? "assistant" as const : "user" as const, content: m.parts }))

    if (svcs.length === 0 || classification.type === "meta") {
      return { ...base, outcome: "no-check-needed", retried: false, firstDraftRejectReasons: [], rejectionReasons: [] }
    }

    const citizenCtxForGrounding = { lifeEvents: activeSituations, employment: persona.employment }

    let draft1 = await withRetry(() => generateFull(systemPrompt, messages))
    // Task APPLY_NOW_FIX: same server-side scrub route.ts applies before
    // grounding — keeps this harness faithful to what a real citizen sees.
    draft1 = stripInvalidApplyNowTags(draft1, svcs, LANG)
    const result1 = await withRetry(() => checkGrounding(draft1, svcs, fullKB, citizenCtxForGrounding, LANG))
    if (result1.grounded) return { ...base, outcome: "passed-first-try", retried: false, firstDraftRejectReasons: [], rejectionReasons: [] }

    const attempt1Reasons = result1.problems || []
    const regenPrompt = `${systemPrompt}\n\nIMPORTANT: your previous draft made these unsupported or incorrect claims: ${JSON.stringify(result1.problems)}. Rewrite your reply using ONLY the facts in the KNOWLEDGE BASE section above. For every entry with review="needs_review" or a low conf, you MUST include an explicit hedge phrase directly next to its specific figures — e.g. "this varies by source — confirm with [agency]" — not just avoid stating a number. Do not repeat these mistakes.`
    let draft2 = await withRetry(() => generateFull(regenPrompt, messages))
    draft2 = stripInvalidApplyNowTags(draft2, svcs, LANG)
    const result2 = await withRetry(() => checkGrounding(draft2, svcs, fullKB, citizenCtxForGrounding, LANG))
    if (result2.grounded) return { ...base, outcome: "passed-on-retry", retried: true, firstDraftRejectReasons: attempt1Reasons, rejectionReasons: attempt1Reasons }

    return { ...base, outcome: "fell-back", retried: true, firstDraftRejectReasons: attempt1Reasons, rejectionReasons: [...attempt1Reasons, ...(result2.problems || [])] }
  } catch (err: any) {
    return { ...base, outcome: "error", retried: false, firstDraftRejectReasons: [], rejectionReasons: [], errorMessage: String(err?.message || err) }
  }
}

// Simple concurrency-limited pool — 150+ sequential turns (each several LLM/
// embedding calls) would take too long serially; unbounded parallelism risks
// rate limits.
async function runPool<T, R>(items: T[], worker: (item: T, i: number) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function runWorker() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, runWorker))
  return results
}

function summarize(records: RunRecord[]) {
  const valid = records.filter(r => r.outcome !== "error")
  const checked = valid.filter(r => r.outcome !== "no-check-needed")
  const fellBack = checked.filter(r => r.outcome === "fell-back")

  console.log("\n================ AGGREGATE 1: OVERALL FALLBACK RATE ================")
  console.log(`Total runs: ${records.length} | errors: ${records.length - valid.length} | no-check-needed: ${valid.length - checked.length}`)
  console.log(`Grounding-checked runs: ${checked.length}`)
  console.log(`  passed-first-try: ${checked.filter(r => r.outcome === "passed-first-try").length}`)
  console.log(`  passed-on-retry:  ${checked.filter(r => r.outcome === "passed-on-retry").length}`)
  console.log(`  fell-back:        ${fellBack.length}`)
  console.log(`OVERALL FALLBACK RATE: ${((fellBack.length / checked.length) * 100).toFixed(1)}%`)

  console.log("\n================ AGGREGATE 2: BY CATEGORY ================")
  const categories = [...new Set(checked.map(r => r.category))]
  for (const cat of categories) {
    const inCat = checked.filter(r => r.category === cat)
    const fb = inCat.filter(r => r.outcome === "fell-back").length
    console.log(`${cat.padEnd(16)} n=${inCat.length.toString().padStart(3)}  fallback=${fb.toString().padStart(3)}  rate=${((fb / inCat.length) * 100).toFixed(1)}%`)
  }
  console.log("\n-- by persona --")
  const personas = [...new Set(checked.map(r => r.persona))]
  for (const p of personas) {
    const inP = checked.filter(r => r.persona === p)
    const fb = inP.filter(r => r.outcome === "fell-back").length
    console.log(`${p.padEnd(14)} n=${inP.length.toString().padStart(3)}  fallback=${fb.toString().padStart(3)}  rate=${((fb / inP.length) * 100).toFixed(1)}%`)
  }

  console.log("\n================ AGGREGATE 3: REJECTION-REASON DISTRIBUTION ================")
  const reasonCounts = new Map<string, number>()
  for (const r of fellBack) {
    for (const reason of r.rejectionReasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1)
    }
  }
  const sorted = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])
  for (const [reason, count] of sorted) {
    console.log(`[${count}x] ${reason}`)
  }

  console.log("\n================ AGGREGATE 4: PER-QUERY FALLBACK FREQUENCY ================")
  const byQuery = new Map<string, RunRecord[]>()
  for (const r of checked) {
    const key = `${r.persona} | "${r.query}"`
    if (!byQuery.has(key)) byQuery.set(key, [])
    byQuery.get(key)!.push(r)
  }
  const queryRates = [...byQuery.entries()].map(([key, runs]) => {
    const fb = runs.filter(r => r.outcome === "fell-back").length
    return { key, fb, total: runs.length, rate: fb / runs.length }
  }).sort((a, b) => b.rate - a.rate)
  for (const q of queryRates) {
    const flag = q.rate === 1 ? "ALWAYS" : q.rate === 0 ? "never" : "FLAKY"
    console.log(`${(q.rate * 100).toFixed(0).padStart(3)}% (${q.fb}/${q.total}) [${flag}]  ${q.key}`)
  }

  // ── TASK_RETRY_RATE_DIAGNOSIS aggregates ──────────────────────────────
  const retried = checked.filter(r => r.retried)
  console.log("\n================ AGGREGATE 5: OVERALL RETRY RATE ================")
  console.log(`Retried (1st draft rejected, regenerate triggered): ${retried.length} / ${checked.length}`)
  console.log(`OVERALL RETRY RATE: ${((retried.length / checked.length) * 100).toFixed(1)}%`)
  console.log(`  of which passed-on-retry (recovered): ${checked.filter(r => r.outcome === "passed-on-retry").length}`)
  console.log(`  of which fell-back (retry also failed): ${fellBack.length}`)

  console.log("\n================ AGGREGATE 6: RETRY RATE BY CATEGORY ================")
  for (const cat of categories) {
    const inCat = checked.filter(r => r.category === cat)
    const rt = inCat.filter(r => r.retried).length
    console.log(`${cat.padEnd(16)} n=${inCat.length.toString().padStart(3)}  retried=${rt.toString().padStart(3)}  rate=${((rt / inCat.length) * 100).toFixed(1)}%`)
  }
  console.log("\n-- by persona --")
  for (const p of personas) {
    const inP = checked.filter(r => r.persona === p)
    const rt = inP.filter(r => r.retried).length
    console.log(`${p.padEnd(14)} n=${inP.length.toString().padStart(3)}  retried=${rt.toString().padStart(3)}  rate=${((rt / inP.length) * 100).toFixed(1)}%`)
  }

  console.log("\n================ AGGREGATE 7: FIRST-DRAFT REJECTION-REASON DISTRIBUTION ================")
  const firstDraftReasonCounts = new Map<string, number>()
  for (const r of retried) {
    for (const reason of r.firstDraftRejectReasons) {
      firstDraftReasonCounts.set(reason, (firstDraftReasonCounts.get(reason) || 0) + 1)
    }
  }
  const firstDraftSorted = [...firstDraftReasonCounts.entries()].sort((a, b) => b[1] - a[1])
  for (const [reason, count] of firstDraftSorted) {
    console.log(`[${count}x] ${reason}`)
  }

  console.log("\n================ AGGREGATE 8: OVERLAP WITH KNOWN (FIXED) FALLBACK CAUSES ================")
  const knownCauseKeywords = ["insaforp", "apply_now", "applyurl", "apply now"]
  let knownCauseHits = 0
  let otherHits = 0
  for (const [reason, count] of firstDraftSorted) {
    const isKnown = knownCauseKeywords.some(kw => reason.toLowerCase().includes(kw))
    if (isKnown) knownCauseHits += count; else otherHits += count
  }
  const totalFirstDraftReasons = knownCauseHits + otherHits
  console.log(`Matches previously-fixed causes (INSAFORP / APPLY_NOW-applyUrl): ${knownCauseHits} / ${totalFirstDraftReasons || 1} (${totalFirstDraftReasons ? ((knownCauseHits / totalFirstDraftReasons) * 100).toFixed(1) : "0.0"}%)`)
  console.log(`Different/new reasons: ${otherHits} / ${totalFirstDraftReasons || 1} (${totalFirstDraftReasons ? ((otherHits / totalFirstDraftReasons) * 100).toFixed(1) : "0.0"}%)`)
  console.log(`"Retry tax" cases (1st draft rejected, but recovered on retry — never became a fallback): ${checked.filter(r => r.outcome === "passed-on-retry").length}`)

  if (records.some(r => r.outcome === "error")) {
    console.log("\n================ ERRORS ================")
    for (const r of records.filter(r => r.outcome === "error")) {
      console.log(`${r.persona} | "${r.query}" (run ${r.runIndex}): ${r.errorMessage}`)
    }
  }
}

async function main() {
  const smoke = process.argv.includes("--smoke")
  const querySet = smoke ? QUERIES.slice(0, 2) : QUERIES
  const kRuns = smoke ? 1 : K

  const jobs: { spec: QuerySpec; runIndex: number }[] = []
  for (const spec of querySet) {
    for (let i = 0; i < kRuns; i++) jobs.push({ spec, runIndex: i })
  }
  console.log(`Running ${jobs.length} total turns (${querySet.length} queries x K=${kRuns})${smoke ? " [SMOKE MODE]" : ""}...`)

  let completed = 0
  const records = await runPool(jobs, async ({ spec, runIndex }) => {
    const r = await runOnce(spec, runIndex)
    completed++
    if (completed % 10 === 0 || completed === jobs.length) console.log(`  ${completed}/${jobs.length} done`)
    return r
  }, smoke ? 2 : 2)

  const outPath = path.join(process.cwd(), smoke ? "scripts/measure-fallback-smoke.json" : "scripts/measure-fallback-results.json")
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2))
  console.log(`\nRaw per-run records written to ${outPath}`)

  summarize(records)
}

main().catch(err => {
  console.error("FATAL:", err)
  process.exit(1)
})
