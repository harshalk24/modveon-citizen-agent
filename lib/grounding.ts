import { Service } from "@/lib/kb"
import { getLLM } from "@/lib/llm"
import { buildKBFacts } from "@/lib/context-builder"

export interface GroundingResult {
  grounded: boolean
  stage?: "entity" | "value" | "faithfulness"
  problems?: string[]
}

export interface CitizenContextForGrounding {
  lifeEvent: string
  employment: string
}

const LOW_CONFIDENCE_THRESHOLD = 0.8

// Single source (Fix B1 — same lesson as R1): lib/plan-verify.ts imports this
// instead of keeping its own hand-copied list, so a hedge recognized here is
// recognized there too — they can't drift apart again.
// "depend" alone used to also catch "depends"/"depending" via substring —
// now that matching is word-boundary (see containsHedgeKeyword below), those
// real inflected hedge phrases need their own explicit entries. "dependent"
// is deliberately NOT listed — that's an unrelated noun (e.g. "ISSS
// dependent"), not a hedge on a figure.
export const HEDGE_KEYWORDS = [
  "confirm", "verify", "unconfirmed", "may vary", "varies", "reported", "depend", "depends", "depending",
  "not confirmed", "based on available", "check with", "unverified",
  "según la información", "confirmá", "verificá", "no confirmado", "puede variar", "varía", "depende",
]

// Word-char class includes Spanish accented letters — plain \b treats accented
// chars as non-word in JS, which would let a boundary match spuriously right
// next to "á"/"í"/etc even mid-word. Defining our own class keeps "confirmá"/
// "depende" matched only at their real word edges, not wherever an accented
// letter happens to sit.
const HEDGE_WORD_CHARS = "a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ"

// Word-boundary hedge match — a bare .includes(keyword) scan (the previous
// implementation) matches a keyword as a SUBSTRING of an unrelated word, e.g.
// "depend" inside "ISSS dependent" or "confirm" inside "confirmation". That
// false match silently suppressed real unhedged-mismatch flags for any KB
// entry whose own name/description happens to contain a hedge keyword as a
// substring (found via sv-isss-dependent-enrollment during the KB fail-closed
// task). This checks each keyword only at real word edges.
export function containsHedgeKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return HEDGE_KEYWORDS.some(k => {
    const escaped = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp(`(?<![${HEDGE_WORD_CHARS}])${escaped}(?![${HEDGE_WORD_CHARS}])`)
    return re.test(lower)
  })
}

// Structural — accepts anything carrying these two fields (e.g. lib/plan-verify.ts's
// DependencyNode, which only has a subset of Service's fields), not just a full Service.
//
// Default is fail-closed: only explicitly-approved (or confidence>=0.8) facts
// are asserted without hedging. Unannotated = treat as unverified. (KB
// fail-closed task: the previous default silently trusted any entry with
// NEITHER reviewStatus nor confidence set — the audit found 21/25 KB entries
// in that state, so silence was being read as "verified" for most of the KB.)
export function isUnverified(s: { reviewStatus?: "needs_review" | "approved"; confidence?: number }): boolean {
  if (s.reviewStatus === "needs_review") return true
  if (s.reviewStatus === "approved") return false
  if (typeof s.confidence === "number") return s.confidence < LOW_CONFIDENCE_THRESHOLD
  return true
}

// ── Stage 1 (deterministic, free) ───────────────────────────────────────
// Does the reply name a real KB scheme (by name/nameEs) that ISN'T among the
// services actually retrieved for this turn? Catches "right context, wrong/
// extra scheme" — e.g. citing a real benefit that doesn't apply here.
// Fully-invented, non-KB-existing schemes are caught by the faithfulness
// stage instead — there's nothing in fullKB to substring-match against.
export function checkEntities(reply: string, retrieved: Service[], fullKB: Service[]): { ok: boolean; problems: string[] } {
  const retrievedIds = new Set(retrieved.map(s => s.id))
  const problems: string[] = []

  for (const s of fullKB) {
    const names = [s.name, s.nameEs].filter((n): n is string => !!n)
    const mentioned = names.some(n => reply.includes(n))
    if (mentioned && !retrievedIds.has(s.id)) {
      problems.push(`Cited "${s.name}" (${s.agency}) which was not among the services retrieved for this query`)
    }
  }

  return { ok: problems.length === 0, problems }
}

// ── Stage 2 (deterministic, free) ───────────────────────────────────────
// Do specific numbers stated in the reply (deadline days, dollar amounts)
// match the retrieved service's own fields? Are needs_review/low-confidence
// entries hedged (Task 5 rule 20) rather than asserted as fact?
export function checkValues(reply: string, retrieved: Service[]): { ok: boolean; problems: string[] } {
  const problems: string[] = []

  // Locate each retrieved service's first mention (by name/nameEs) in the reply,
  // so number/hedge checks can be scoped to THAT service's own text block —
  // otherwise a correct number stated for service A gets misattributed to
  // service B just because both names appear somewhere in the same reply.
  const mentions = retrieved
    .map(s => {
      const idx = [s.name, s.nameEs]
        .filter((n): n is string => !!n)
        .map(n => reply.indexOf(n))
        .filter(i => i !== -1)
        .sort((a, b) => a - b)[0]
      return idx === undefined ? null : { service: s, idx }
    })
    .filter((m): m is { service: Service; idx: number } => m !== null)

  for (const { service: s, idx } of mentions) {
    // Block = from this mention up to the next divider or the next OTHER
    // retrieved service's mention, whichever comes first (or end of reply).
    let end = reply.length
    const nextDivider = reply.indexOf("---", idx + 1)
    if (nextDivider !== -1) end = Math.min(end, nextDivider)
    for (const other of mentions) {
      if (other.idx > idx) end = Math.min(end, other.idx)
    }
    const block = reply.slice(idx, end)
    const hasHedge = containsHedgeKeyword(block)
    const unverified = isUnverified(s)

    if (s.deadlineDays) {
      // An entry's `deadlineDays` is its single headline deadline, but its own
      // description/tip can legitimately state OTHER real durations too — e.g.
      // maternity benefit's 112-day leave length vs. its separate 12-month
      // contribution window and 6-month employer-tenure eligibility rules.
      // Those aren't competing "deadlines"; they're different KB-backed facts.
      // Trust any duration that appears in the service's OWN description text,
      // not just the single deadlineDays field, before flagging a mismatch.
      const backedDurations = new Set<number>([s.deadlineDays])
      for (const text of [s.description, s.descriptionEs, s.universalTip].filter((t): t is string => !!t)) {
        for (const m of Array.from(text.matchAll(/(\d+)\s*(day|días?|week|semanas?|month|meses?)/gi))) {
          const n = parseInt(m[1], 10)
          const unit = m[2].toLowerCase()
          backedDurations.add(
            unit.startsWith("week") || unit.startsWith("sem") ? n * 7
              : unit.startsWith("month") || unit.startsWith("mes") ? n * 30
              : n
          )
        }
      }

      const dayMatches = Array.from(block.matchAll(/(\d+)\s*(day|días?|week|semanas?|month|meses?)/gi))
      for (const m of dayMatches) {
        const n = parseInt(m[1], 10)
        const unit = m[2].toLowerCase()
        const days = unit.startsWith("week") || unit.startsWith("sem") ? n * 7
          : unit.startsWith("month") || unit.startsWith("mes") ? n * 30
          : n
        const backed = Array.from(backedDurations).some(d => Math.abs(days - d) <= 1)
        if (!backed) {
          if (unverified && !hasHedge) {
            problems.push(`States "${n} ${m[2]}" for "${s.name}" without hedging, but this figure is unverified (${s.reviewStatus ?? `confidence ${s.confidence}`})`)
          } else if (!unverified) {
            problems.push(`States "${n} ${m[2]}" for "${s.name}" but this isn't backed by the retrieved deadline (${s.deadlineDays} days) or the service's own description`)
          }
        }
      }
    }

    if (s.amount) {
      const kbNumbers = Array.from(s.amount.matchAll(/[\d,]+(?:\.\d+)?/g)).map(m => m[0].replace(/,/g, ""))
      const replyDollarMatches = Array.from(block.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g))
      for (const m of replyDollarMatches) {
        const val = m[1].replace(/,/g, "")
        if (!kbNumbers.includes(val)) {
          if (unverified && !hasHedge) {
            problems.push(`States "$${val}" for "${s.name}" without hedging, but this figure is unverified (${s.reviewStatus ?? `confidence ${s.confidence}`})`)
          } else if (!unverified) {
            problems.push(`States "$${val}" for "${s.name}" but the retrieved amount is "${s.amount}"`)
          }
        }
      }
    }

    // A number stated in the block that exactly matches a trusted structured
    // field (deadlineDays, or one of amount's own numbers) is backed by real
    // KB data — it doesn't need hedging just because the entry's OVERALL
    // reviewStatus is needs_review (e.g. birthCert's deadline is solid; only
    // its cost is disputed). Only figures with NO structured field to back
    // them (e.g. a dollar amount when `amount` isn't set at all, or ANY
    // duration for an entry with no deadlineDays) are "unexplained" and must
    // be hedged when the entry is unverified.
    if (unverified) {
      const dayMatches = Array.from(block.matchAll(/(\d+)\s*(day|días?|week|semanas?|month|meses?)/gi))
      const hasUnexplainedDuration = dayMatches.some(m => {
        if (s.deadlineDays === undefined) return true
        const n = parseInt(m[1], 10)
        const unit = m[2].toLowerCase()
        const days = unit.startsWith("week") || unit.startsWith("sem") ? n * 7
          : unit.startsWith("month") || unit.startsWith("mes") ? n * 30
          : n
        return Math.abs(days - s.deadlineDays) > 1
      })

      const dollarMatches = Array.from(block.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g))
      const kbAmountNumbers = s.amount ? Array.from(s.amount.matchAll(/[\d,]+(?:\.\d+)?/g)).map(m => m[0].replace(/,/g, "")) : []
      const hasUnexplainedAmount = dollarMatches.some(m => !kbAmountNumbers.includes(m[1].replace(/,/g, "")))

      if ((hasUnexplainedDuration || hasUnexplainedAmount) && !hasHedge) {
        problems.push(`"${s.name}" is unverified (${s.reviewStatus ?? `confidence ${s.confidence}`}) but the reply states a specific figure without hedging`)
      }
    }

    // Cost enforceability (Task 8): these three checks apply REGARDLESS of
    // reviewStatus/confidence — an "approved" entry only vouches for the
    // fields it actually has. A missing `amount` field is not evidence of
    // "free", and a genuinely tiered cost (costUncertain) isn't honestly
    // reducible to one flat figure just because the entry itself is trusted.
    const freeClaimed = /\bfree\b|\bgratis\b/i.test(block)
    const dollarMatchesForCost = Array.from(block.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g))

    if (!s.amount) {
      // No structured cost field at all — no cost claim (dollar or "free") is
      // backed by anything. A hedged guess is still fine; an unhedged
      // assertion is not, no matter how trusted the rest of the entry is.
      if ((dollarMatchesForCost.length > 0 || freeClaimed) && !hasHedge) {
        problems.push(`"${s.name}" has no structured cost field ("amount") to back any cost claim — the reply states a cost without hedging`)
      }
    } else {
      // A structured amount exists — a "free" claim that contradicts it is
      // simply wrong, hedge or not; hedging doesn't excuse a false claim.
      const amountDenotesFree = /\bfree\b|\bgratis\b|\$0(?:\.0+)?\b/i.test(s.amount)
      if (freeClaimed && !amountDenotesFree) {
        problems.push(`"${s.name}" is stated as free/gratis but the retrieved amount is "${s.amount}"`)
      }
    }

    if (s.costUncertain && dollarMatchesForCost.length > 0 && !hasHedge) {
      // The cost is genuinely tiered — presenting any single figure as THE
      // cost (even one that matches a real tier) without variance/hedge
      // language is misleading.
      problems.push(`"${s.name}" has a genuinely variable cost — a single figure must be framed as one option among several (varies/depends/confirm), not stated as the flat cost`)
    }
  }

  return { ok: problems.length === 0, problems }
}

// Shared by all three faithfulness sub-checks — parses the judge's JSON,
// fails safe (UNSUPPORTED) on any parse/API error.
//
// Neither "verdict" nor "problems" is fully trustworthy alone — testing during
// J1 found the model produces the IDENTICAL shape (verdict:"UNSUPPORTED",
// problems:[]) for two opposite situations: a spurious non-issue (nothing to
// name) AND a genuine miss (it knows there's a contradiction but fails to
// write it down). Those can't be told apart after the fact — the fix has to
// be upstream (clear prompting so the model doesn't produce that empty-body
// shape at all), and until that's fully reliable, this fails safe on EITHER
// signal of trouble: it takes BOTH verdict==="SUPPORTED" AND an empty
// problems array to pass. Matches this system's own stated bias — a false
// positive (wrongly approving) is the dangerous failure; a false negative
// (over-cautious reject) costs a fallback reply, never a wrong one.
async function runJudgeCall(prompt: string): Promise<{ ok: boolean; problems: string[] }> {
  try {
    const text = (await getLLM().complete(prompt, { temperature: 0.0, maxTokens: 300, json: true })).trim()
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
    const problems = Array.isArray(parsed.problems)
      ? parsed.problems.filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
      : []
    if (parsed.verdict === "SUPPORTED" && problems.length === 0) return { ok: true, problems: [] }
    return {
      ok: false,
      problems: problems.length > 0 ? problems : ["Faithfulness check returned UNSUPPORTED with no specific reason given"],
    }
  } catch (e) {
    console.error("Faithfulness sub-check failed — failing safe as UNSUPPORTED:", e)
    return { ok: false, problems: ["Faithfulness check could not be completed (parse/API error) — failing safe"] }
  }
}

// Sub-check 1/3: contradiction only — small, fixed-size context (citizen
// context is 2 fields), not affected by the payload-size failure mode below.
async function checkContradiction(reply: string, ctx: CitizenContextForGrounding): Promise<{ ok: boolean; problems: string[] }> {
  const prompt = `You are reviewing a draft reply from a government-benefits assistant before it reaches a citizen. Check ONLY ONE thing: does the reply CONTRADICT the citizen's own known context?

CITIZEN CONTEXT: ${JSON.stringify({ lifeEvent: ctx.lifeEvent, employment: ctx.employment })}

CANDIDATE REPLY:
"""
${reply}
"""

A contradiction means the reply ASSERTS something FALSE about the citizen's situation — e.g. opening with sympathy for a job loss when their actual life event is a new baby, or stating an eligibility rule that contradicts their known employment status.
- Silence is always safe: the reply is NOT required to mention or acknowledge their life event/employment. Not mentioning it is never a contradiction — do not put a note about this in "problems" even as a minor caveat.
- QUESTIONS ARE NEVER CONTRADICTIONS: if the reply ASKS the citizen something ("do you have a storefront or employees?", "what is the poder for?") instead of asserting it, that has no truth value to check.
- "employment" (formal/informal/unemployed) describes how the citizen earns income personally — it says NOTHING about the size/structure/staffing of a business or situation they're asking about. A citizen with "informal" employment can still run a business with a storefront or employees; asking about that is not a contradiction.
- A general, explicitly conditional rule ("you need X if your assets are $12,000 or more") is not an assertion about this specific citizen — only a contradiction if the reply drops the condition and asserts it applies to them without knowing that yet.

CRITICAL: "problems" must be EMPTY unless the reply asserts something DEFINITELY, FACTUALLY FALSE about the citizen's situation. Never put a hedge, caveat, "may imply", "could suggest", or incompleteness note into "problems" — those are not contradictions, and this field must not contain anything that isn't an actual contradiction. If you cannot state a specific FALSE assertion the reply makes about the citizen, "problems" must be [] and verdict "SUPPORTED".

Return ONLY this JSON: {"verdict": "SUPPORTED" or "UNSUPPORTED", "problems": ["<the contradiction, if any>"]}`
  return runJudgeCall(prompt)
}

// Sub-check 2/3: a claim naming a government agency that isn't legitimately
// in play for this turn at all — the one thing per-service checks (below)
// can't catch, since each of those is deliberately scoped to ignore claims
// unrelated to its own service.
async function checkFabricatedAgency(reply: string, retrieved: Service[]): Promise<{ ok: boolean; problems: string[] }> {
  const knownAgencies = Array.from(new Set(retrieved.map(s => s.agency)))
  const knownServiceNames = Array.from(new Set(retrieved.flatMap(s => [s.name, s.nameEs])))
  const prompt = `You are reviewing a draft reply from a government-benefits assistant before it reaches a citizen. Check ONLY ONE thing: does the reply tell the citizen they must deal with a government AGENCY/OFFICE that is NOT in this list of legitimately retrieved agencies for this turn?

KNOWN LEGITIMATE AGENCIES FOR THIS TURN (who ADMINISTERS a benefit — e.g. "ISSS", "RNPN"): ${JSON.stringify(knownAgencies)}
KNOWN SERVICE/BENEFIT NAMES FOR THIS TURN (what the citizen is APPLYING FOR — these are NOT agencies, do not flag them as agencies even if they sound official): ${JSON.stringify(knownServiceNames)}

CANDIDATE REPLY:
"""
${reply}
"""

Flag ONLY a claim that names a SPECIFIC agency/office NOT in the agencies list above, presented as somewhere the citizen must additionally go/register/contact. A benefit or service NAME (from the second list, or any close variant of it) is never itself an agency — "you need the [Service Name]" is a claim about applying for that service, not a claim about a new agency, even if the service's name sounds institutional. Do NOT flag generic mentions ("your employer", "the office", "your consulate", "the agency") that don't name a specific NEW agency. Do NOT flag anything else — no cost, hedge, or eligibility checking here, that's handled elsewhere. Silence about agencies is always fine.

DEFAULT TO SUPPORTED. Most replies name zero agencies outside the known list — that is the common, correct case. Only set verdict to "UNSUPPORTED" if you can name the exact fabricated agency (an actual office/institution, not a service name) in "problems". If "problems" would be empty, the verdict MUST be "SUPPORTED" — never return UNSUPPORTED with no claim named.

Example: known agencies ["RNPN"], known service names ["Birth certificate — RNPN"]. Reply: "You need the birth certificate from RNPN, it costs about $3-5." → SUPPORTED, problems: []. No other agency was named.
Example: known agencies ["RNPN"], known service names ["Test Sample Service"]. Reply: "You need the Test Sample Service. Please confirm the fee with the agency." → SUPPORTED, problems: []. "Test Sample Service" is the BENEFIT being applied for (it's in the known service names list), not a new agency — "the agency" here is a generic reference, not a new specific one.
Example: known agencies ["RNPN"]. Reply: "You need the birth certificate from RNPN, and you must also register with the Ministry of Labor." → UNSUPPORTED, problems: ["Ministry of Labor — not a retrieved agency for this turn"].

Return ONLY this JSON: {"verdict": "SUPPORTED" or "UNSUPPORTED", "problems": ["<the fabricated agency claim, if any>"]}`
  return runJudgeCall(prompt)
}

// Sub-check 3/3 (run once per retrieved service): does the reply say
// anything WRONG or UNSUPPORTED specifically about THIS service?
//
// Fix J1 (root cause, confirmed by direct experiment): the OLD single call
// gave the judge ALL retrieved services' facts at once (up to 5+ dense JSON
// objects). A controlled test proved the facts array SIZE — not prompt
// wording — is what breaks the judge's recall: the exact same reply,
// isolated with ONLY its own service's fact and a short prompt, correctly
// returned SUPPORTED; the same reply against the full 5-service array,
// even with heavy prompt tightening (mandatory self-check + matching
// few-shot examples), returned byte-for-byte identical wrong verdicts. So
// this checks ONE service's fact per call — small payload, matching what
// the experiment showed the model can actually do reliably — and the
// per-service scoping below (ignore claims about OTHER services) is what
// keeps a multi-service reply from failing every single iteration.
async function checkOneServiceSupport(
  reply: string,
  fact: ReturnType<typeof buildKBFacts>[number] & { unverified: boolean }
): Promise<{ ok: boolean; problems: string[] }> {
  const prompt = `You are reviewing a draft reply from a government-benefits assistant before it reaches a citizen. You are checking ONLY claims about ONE specific service: "${fact.name}" (${fact.agency}).

RETRIEVED FACT FOR THIS ONE SERVICE (the only thing claims about "${fact.name}" are allowed to say): ${JSON.stringify(fact)}

CANDIDATE REPLY (may discuss other services too — IGNORE anything not about "${fact.name}"):
"""
${reply}
"""

Scope: if the reply says nothing about "${fact.name}" specifically, or only discusses OTHER services/topics, return SUPPORTED — there is nothing to check here. Other services are checked separately, in their own pass; do not evaluate them here. A claim is only "about" "${fact.name}" if the reply names "${fact.name}" (or clearly refers back to it) at or near that claim — a generic-sounding claim (a document list, a number, a duration) that appears somewhere else in the reply, discussing a DIFFERENT named service, is NOT a claim about "${fact.name}" just because "${fact.name}" also happens to have a similar-shaped field (its own documents/deadline/amount). Do not compare an unrelated part of the reply against this fact's fields merely because both involve documents or numbers.
Example: this service is "Paternity benefit", whose own documents are ["Father's DUI", "Baby's birth certificate", "Employer certification"]. The reply is entirely about a DIFFERENT service and says "you'll need: Your DUI, Hospital discharge certificate, ISSS referral form" without ever naming "Paternity benefit" nearby. → SUPPORTED. That document list belongs to the other service being discussed, not to Paternity benefit — do not flag it as an unsupported/mismatched document list for Paternity benefit just because Paternity benefit also has a "docs" field.

This check is about INCORRECT or UNSUPPORTED claims, never about INCOMPLETENESS. A reply that omits part of this fact (a caveat, a tier, a nuance) is NOT a violation — silence is always safe. NEVER flag a claim for something the reply DOESN'T say; only for something it DOES say that is wrong or unbacked ABOUT THIS SPECIFIC SERVICE.

Before flagging anything about "${fact.name}", re-read the fact's own "deadline" and "tip" strings above in full, word by word — claims are very often a close paraphrase of text already inside one of those strings, not a separate field. A number, day-count, or eligibility rule stated in the reply is SUPPORTED if it's a paraphrase, a near-verbatim match, or a reasonable specific instance of a general rule in "deadline"/"tip"/"amount"/"docs" (e.g. the tip says "if used in court, must be a lawyer" — a custody case IS a court matter, so that's covered).

Hedge check: if "unverified" is true above, the reply may state an approximate figure as long as it is hedged in SOME way. Before saying "no hedge," scan the sentence for ANY of: confirm, verify, unconfirmed, may vary, varies, vary, varía, reported, depend, depends, depende, not confirmed, based on available, check with, unverified, según, puede variar, aproximadamente, alrededor de, approximately, around, about. If any appears anywhere in or near that sentence, hedge language IS present — it is SUPPORTED, do not flag it.

Do not check for a fabricated agency name here (handled elsewhere) or for contradictions with the citizen's context (handled elsewhere) — only whether THIS service's own claims are backed by the fact given above.

CRITICAL: "problems" must be EMPTY unless the reply asserts a NUMBER, ELIGIBILITY RULE, or DOCUMENT for "${fact.name}" that is DEFINITELY not backed by the fact above. Before adding anything to "problems", ask: "is my reason actually 'the reply doesn't mention/clarify/state a caveat'?" — if yes, DELETE it, that is incompleteness and this field must not contain it. If you cannot name a specific claim that is factually WRONG (not just less detailed than the source fact), "problems" must be [] and verdict "SUPPORTED".

Return ONLY this JSON: {"verdict": "SUPPORTED" or "UNSUPPORTED", "problems": ["<the unsupported claim about ${fact.name}, if any>"]}`
  return runJudgeCall(prompt)
}

// ── Stage 3 (LLM backstop) ───────────────────────────────────────────────
// Catches distortions the deterministic stages miss: claims not backed by
// the retrieved facts, or a reply that contradicts the citizen's own context
// (e.g. sympathizing about a job loss when lifeEvent=new-baby).
export async function checkFaithfulness(
  reply: string,
  retrieved: Service[],
  ctx: CitizenContextForGrounding,
  language: "en" | "es"
): Promise<{ ok: boolean; problems: string[] }> {
  const contradiction = await checkContradiction(reply, ctx)
  if (!contradiction.ok) return contradiction

  const fabricatedAgency = await checkFabricatedAgency(reply, retrieved)
  if (!fabricatedAgency.ok) return fabricatedAgency

  // Fix R1 principle preserved: each per-service fact still comes from the
  // SAME buildKBFacts generation uses — just called with one service at a
  // time instead of the whole array, so "the judge sees exactly what
  // generation saw" for THAT service remains true by construction.
  const problems: string[] = []
  for (let i = 0; i < retrieved.length; i++) {
    const [fact] = buildKBFacts([retrieved[i]], language)
    const factWithMeta = { ...fact, unverified: isUnverified(retrieved[i]) }
    const result = await checkOneServiceSupport(reply, factWithMeta)
    if (!result.ok) problems.push(...result.problems)
  }

  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, problems: [] }
}

// ── Orchestrator — deterministic stages first (cheapest first) ──────────
export async function check(
  reply: string,
  retrieved: Service[],
  fullKB: Service[],
  ctx: CitizenContextForGrounding,
  language: "en" | "es" = "en"
): Promise<GroundingResult> {
  const entity = checkEntities(reply, retrieved, fullKB)
  if (!entity.ok) return { grounded: false, stage: "entity", problems: entity.problems }

  const value = checkValues(reply, retrieved)
  if (!value.ok) return { grounded: false, stage: "value", problems: value.problems }

  // Must be the SAME language generation actually used, or a Spanish reply's
  // Spanish document names won't match the judge's (English) facts.
  const faithfulness = await checkFaithfulness(reply, retrieved, ctx, language)
  if (!faithfulness.ok) return { grounded: false, stage: "faithfulness", problems: faithfulness.problems }

  return { grounded: true }
}

// ── Fallback — built directly from retrieved (= inherently grounded) data.
// Never attempts to salvage text from either failed LLM draft.
export function buildFallbackReply(
  retrieved: Service[],
  language: "en" | "es",
  // Task S1: when a CRITICAL slot is still missing, the natural LLM draft can
  // end up asserting the tier-dependent fact it isn't supposed to assert yet
  // (that's often WHY grounding failed here) — so the safe fallback must lead
  // with the proxy question itself rather than a flat "couldn't confirm" dump,
  // to honor rule 4 (ask before asserting) even on the fail-safe path.
  criticalSlotAsk?: { en: string; es: string } | null
): string {
  const isEs = language === "es"

  if (retrieved.length === 0) {
    return isEs
      ? "No tengo información verificada para responder con precisión en este momento. Contame más sobre tu situación para poder ayudarte mejor."
      : "I don't have verified information to answer precisely right now. Tell me more about your situation so I can help."
  }

  const blocks = retrieved.map(s => {
    const name = isEs ? s.nameEs : s.name
    const docs = (isEs ? s.documentsEs : s.documents).join(", ")
    const unverified = isUnverified(s)

    const amountLine = s.amount
      ? (unverified
          ? (isEs ? `Monto: según la información disponible, ${s.amount} — confirmá con ${s.agency}.` : `Amount: based on available info, ${s.amount} — confirm with ${s.agency}.`)
          : (isEs ? `Monto: ${s.amount}` : `Amount: ${s.amount}`))
      : null
    const deadlineLine = s.deadline
      ? (unverified
          ? (isEs ? `Plazo: según la información disponible, ${s.deadline} — confirmá con ${s.agency}.` : `Deadline: based on available info, ${s.deadline} — confirm with ${s.agency}.`)
          : (isEs ? `Plazo: ${s.deadline}` : `Deadline: ${s.deadline}`))
      : null

    return [
      `**${name}** · ${s.agency}`,
      amountLine,
      deadlineLine,
      isEs ? `Documentos: ${docs}` : `Documents: ${docs}`,
    ].filter((line): line is string => !!line).join("\n")
  })

  const intro = criticalSlotAsk
    ? (isEs
        ? `Antes de darte una guía específica, contame: ${criticalSlotAsk.es} Mientras tanto, esto es lo que ya puedo confirmar:`
        : `Before I give you specific guidance, tell me: ${criticalSlotAsk.en} In the meantime, here's what I can already confirm:`)
    : (isEs
        ? "No pude confirmar todos los detalles con total certeza, así que te comparto solo lo verificado:"
        : "I couldn't confirm every detail with full certainty, so here's only what's verified:")

  return [intro, ...blocks].join("\n\n---\n\n")
}
