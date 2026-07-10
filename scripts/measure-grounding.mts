// Task M1, Part B — fixed baseline script. Runs a repeatable set of realistic
// persona queries through the REAL turn pipeline (the running dev server's
// /api/chat), then reads back the structured fallback log (Task M1, Part A)
// to produce a human-readable report: summary numbers + every non-pass turn
// with its failed draft(s), stage/reason, and final reply, for hand-judging
// legitimate-catch vs. over-strict-judge.
//
// Requires: the dev server running on http://localhost:3000 with a real
// OPENAI_API_KEY (this exercises the actual LLM + judge, not a mock).
// Usage: node --import tsx scripts/measure-grounding.mts

import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const BASE_URL = process.env.MEASURE_BASE_URL || "http://localhost:3000"
const RUN_ID = `measure-${Date.now()}`

interface PersonaQuery {
  group: string
  persona: string
  query: string
  profile: {
    firstName: string
    country: string
    employment: string
    lifeEvent: string
    language: "en" | "es"
  }
}

// ~24 realistic queries across the 4 groups + out-of-scope, per Task M1's spec.
// Profiles are pre-set (as if already onboarded) rather than replaying the
// multi-turn confirmation dance — that dance is fixed-string, never reaches
// grounding, and would inflate the denominator without being measurable.
const QUERIES: PersonaQuery[] = [
  // ── new-baby, formal (María) ──────────────────────────────────────────
  { group: "new-baby-formal", persona: "María", query: "I just had a baby, what am I entitled to?", profile: { firstName: "María", country: "SV", employment: "formal", lifeEvent: "new-baby", language: "en" } },
  { group: "new-baby-formal", persona: "María", query: "Am I eligible for the ISSS maternity benefit?", profile: { firstName: "María", country: "SV", employment: "formal", lifeEvent: "new-baby", language: "en" } },
  { group: "new-baby-formal", persona: "María", query: "What should I do first?", profile: { firstName: "María", country: "SV", employment: "formal", lifeEvent: "new-baby", language: "en" } },
  { group: "new-baby-formal", persona: "María", query: "How long does maternity leave last?", profile: { firstName: "María", country: "SV", employment: "formal", lifeEvent: "new-baby", language: "en" } },
  { group: "new-baby-formal", persona: "María", query: "How much does the birth certificate cost?", profile: { firstName: "María", country: "SV", employment: "formal", lifeEvent: "new-baby", language: "en" } },
  { group: "new-baby-formal", persona: "María", query: "Can you walk me through my plan step by step?", profile: { firstName: "María", country: "SV", employment: "formal", lifeEvent: "new-baby", language: "en" } },

  // ── new-baby, informal ────────────────────────────────────────────────
  { group: "new-baby-informal", persona: "Ana", query: "I had a baby but I'm self-employed, what can I get?", profile: { firstName: "Ana", country: "SV", employment: "informal", lifeEvent: "new-baby", language: "en" } },
  { group: "new-baby-informal", persona: "Ana", query: "Do I still qualify for anything if I don't have a formal job?", profile: { firstName: "Ana", country: "SV", employment: "informal", lifeEvent: "new-baby", language: "en" } },
  { group: "new-baby-informal", persona: "Ana", query: "What documents do I need for the birth certificate?", profile: { firstName: "Ana", country: "SV", employment: "informal", lifeEvent: "new-baby", language: "en" } },
  { group: "new-baby-informal", persona: "Ana", query: "Is there a subsidy for my child?", profile: { firstName: "Ana", country: "SV", employment: "informal", lifeEvent: "new-baby", language: "en" } },

  // ── business (Rosa) ───────────────────────────────────────────────────
  { group: "business", persona: "Rosa", query: "I want to register my food business, just me, small stall.", profile: { firstName: "Rosa", country: "SV", employment: "informal", lifeEvent: "start-business", language: "en" } },
  { group: "business", persona: "Rosa", query: "Tell me about the CONAMYPE grant.", profile: { firstName: "Rosa", country: "SV", employment: "informal", lifeEvent: "start-business", language: "en" } },
  { group: "business", persona: "Rosa", query: "How much does it cost to register my business?", profile: { firstName: "Rosa", country: "SV", employment: "informal", lifeEvent: "start-business", language: "en" } },
  { group: "business", persona: "Rosa", query: "What documents do I need for the NIT?", profile: { firstName: "Rosa", country: "SV", employment: "informal", lifeEvent: "start-business", language: "en" } },
  { group: "business", persona: "Rosa", query: "¿Cuánto cuesta registrar mi negocio?", profile: { firstName: "Rosa", country: "SV", employment: "informal", lifeEvent: "start-business", language: "es" } },

  // ── diaspora (José) ───────────────────────────────────────────────────
  { group: "diaspora", persona: "José", query: "I need a poder from the US to sell my parents' house.", profile: { firstName: "José", country: "SV", employment: "formal", lifeEvent: "diaspora", language: "en" } },
  { group: "diaspora", persona: "José", query: "Do I need an apostille for the poder?", profile: { firstName: "José", country: "SV", employment: "formal", lifeEvent: "diaspora", language: "en" } },
  { group: "diaspora", persona: "José", query: "Can a US notary do this instead?", profile: { firstName: "José", country: "SV", employment: "formal", lifeEvent: "diaspora", language: "en" } },
  { group: "diaspora", persona: "José", query: "What if the poder is for a custody case in court, not property?", profile: { firstName: "José", country: "SV", employment: "formal", lifeEvent: "diaspora", language: "en" } },

  // ── generic / depth follow-ups ────────────────────────────────────────
  { group: "generic", persona: "María", query: "Where do I go to apply for the birth certificate?", profile: { firstName: "María", country: "SV", employment: "formal", lifeEvent: "new-baby", language: "en" } },
  { group: "generic", persona: "María", query: "What if I have problems when I get there?", profile: { firstName: "María", country: "SV", employment: "formal", lifeEvent: "new-baby", language: "en" } },
  { group: "generic", persona: "Rosa", query: "What's the next step after I get my NIT?", profile: { firstName: "Rosa", country: "SV", employment: "informal", lifeEvent: "start-business", language: "en" } },

  // ── out-of-scope ──────────────────────────────────────────────────────
  { group: "out-of-scope", persona: "María", query: "What's the weather like today?", profile: { firstName: "María", country: "SV", employment: "formal", lifeEvent: "new-baby", language: "en" } },
  { group: "out-of-scope", persona: "José", query: "Can you help me file my US taxes?", profile: { firstName: "José", country: "SV", employment: "formal", lifeEvent: "diaspora", language: "en" } },
]

async function onboardCitizen(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/citizen/onboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  const data = await res.json()
  return data.citizenId
}

async function runQuery(citizenId: string, sessionId: string, pq: PersonaQuery): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      citizenId, sessionId, language: pq.profile.language,
      contextData: { profile: pq.profile, entitlements: [], planSteps: [], deadlines: [] },
      messages: [{ role: "user", content: pq.query }],
    }),
  })
  return res.text()
}

async function main() {
  console.log(`Running ${QUERIES.length} persona queries against ${BASE_URL} (run: ${RUN_ID})...`)

  const citizenIds: string[] = []
  const sessionIds: string[] = []
  const finalReplies: { pq: PersonaQuery; sessionId: string; reply: string }[] = []

  for (const [i, pq] of QUERIES.entries()) {
    const citizenId = await onboardCitizen()
    const sessionId = `${RUN_ID}-${i}`
    citizenIds.push(citizenId)
    sessionIds.push(sessionId)

    console.log(`[${i + 1}/${QUERIES.length}] (${pq.group}/${pq.persona}) "${pq.query}"`)
    try {
      const reply = await runQuery(citizenId, sessionId, pq)
      finalReplies.push({ pq, sessionId, reply })
    } catch (err) {
      console.error(`  ERROR: ${err}`)
      finalReplies.push({ pq, sessionId, reply: `[SCRIPT ERROR: ${err}]` })
    }
  }

  // Part A's logging is fire-and-forget (non-blocking) — give the last few
  // writes a moment to land before reading them back.
  await new Promise(r => setTimeout(r, 1500))

  const fallbacks = await prisma.groundingFallback.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: { createdAt: "asc" },
  })
  const fallbackBySession = new Map(fallbacks.map(f => [f.sessionId, f]))

  const total = QUERIES.length
  const fellBack = fallbacks.filter(f => f.outcome === "fell-back").length
  const regenerated = fallbacks.filter(f => f.outcome === "regenerated").length
  const passedFirstTry = total - fallbacks.length
  const fallbackRate = ((fallbacks.length / total) * 100).toFixed(1)

  const lines: string[] = []
  lines.push(`# Grounding fallback measurement — ${RUN_ID}`)
  lines.push("")
  lines.push(`Run against: ${BASE_URL}`)
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push("")
  lines.push("## Summary")
  lines.push("")
  lines.push(`- Total turns: ${total}`)
  lines.push(`- Passed on first try: ${passedFirstTry}`)
  lines.push(`- Regenerated then passed: ${regenerated}`)
  lines.push(`- Fell back to safe template: ${fellBack}`)
  lines.push(`- **Non-pass rate (regenerated + fell-back): ${fallbackRate}%**`)
  lines.push("")
  lines.push("## Every non-pass turn — hand-judge legit vs. over-strict")
  lines.push("")
  lines.push("For each: the query, every failed draft with the stage+reason the judge gave, and the final reply actually shown.")
  lines.push("")

  let n = 0
  for (const { pq, sessionId, reply } of finalReplies) {
    const fb = fallbackBySession.get(sessionId)
    if (!fb) continue
    n++
    const attempts = JSON.parse(fb.attemptsJson) as { attempt: number; draft: string; stage?: string; reasons?: string[]; passed: boolean }[]

    lines.push(`---`)
    lines.push("")
    lines.push(`### ${n}. [${pq.group} / ${pq.persona}] outcome: **${fb.outcome}**`)
    lines.push("")
    lines.push(`**Query:** ${pq.query}`)
    lines.push("")
    for (const a of attempts) {
      lines.push(`**Attempt ${a.attempt}** — ${a.passed ? "PASSED" : `FAILED (stage: ${a.stage})`}`)
      if (!a.passed && a.reasons?.length) {
        lines.push(`Reason(s): ${a.reasons.join(" | ")}`)
      }
      lines.push("")
      lines.push("```")
      lines.push(a.draft)
      lines.push("```")
      lines.push("")
    }
    lines.push(`**Final reply shown to citizen:**`)
    lines.push("")
    lines.push("```")
    lines.push(reply)
    lines.push("```")
    lines.push("")
    lines.push(`Your judgment: [ ] legitimate catch   [ ] over-strict`)
    lines.push("")
  }

  if (n === 0) {
    lines.push("_No non-pass turns in this run — every query passed grounding on the first attempt._")
  }

  const report = lines.join("\n")
  const reportPath = path.join(process.cwd(), `measure-grounding-report-${RUN_ID}.md`)
  fs.writeFileSync(reportPath, report)

  console.log("")
  console.log("=== SUMMARY ===")
  console.log(`Total: ${total} | Passed first try: ${passedFirstTry} | Regenerated: ${regenerated} | Fell back: ${fellBack}`)
  console.log(`Non-pass rate: ${fallbackRate}%`)
  console.log(`Full report written to: ${reportPath}`)

  // Clean up the throwaway test citizens created for this run — the
  // measurement data itself (GroundingFallback rows) is left in place, it IS
  // the artifact this script produces.
  for (const citizenId of citizenIds) {
    await prisma.deadline.deleteMany({ where: { citizenId } })
    await prisma.actionPlan.deleteMany({ where: { citizenId } })
    await prisma.citizenContext.deleteMany({ where: { citizenId } })
    await prisma.citizen.deleteMany({ where: { id: citizenId } })
  }
  console.log(`Cleaned up ${citizenIds.length} throwaway test citizens.`)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
