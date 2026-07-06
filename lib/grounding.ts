import { Service } from "@/lib/kb"
import { getLLM } from "@/lib/llm"

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

const HEDGE_KEYWORDS = [
  "confirm", "verify", "unconfirmed", "may vary", "varies", "reported", "depend",
  "not confirmed", "based on available", "check with", "unverified",
  "según la información", "confirmá", "verificá", "no confirmado", "puede variar", "varía", "depende",
]

// Structural — accepts anything carrying these two fields (e.g. lib/plan-verify.ts's
// DependencyNode, which only has a subset of Service's fields), not just a full Service.
export function isUnverified(s: { reviewStatus?: "needs_review" | "approved"; confidence?: number }): boolean {
  return s.reviewStatus === "needs_review" || (typeof s.confidence === "number" && s.confidence < LOW_CONFIDENCE_THRESHOLD)
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
    const hasHedge = HEDGE_KEYWORDS.some(k => block.toLowerCase().includes(k))
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

// ── Stage 3 (LLM backstop) ───────────────────────────────────────────────
// Catches distortions the deterministic stages miss: claims not backed by
// the retrieved facts, or a reply that contradicts the citizen's own context
// (e.g. sympathizing about a job loss when lifeEvent=new-baby).
export async function checkFaithfulness(
  reply: string,
  retrieved: Service[],
  ctx: CitizenContextForGrounding
): Promise<{ ok: boolean; problems: string[] }> {
  // Must mirror what the generation prompt was actually given (context-builder.ts's
  // compactKB) — otherwise the judge flags accurate, tip/document-sourced facts as
  // unsupported just because this payload didn't carry them.
  const facts = retrieved.map(s => ({
    name: s.name,
    agency: s.agency,
    amount: s.amount ?? null,
    deadline: s.deadline ?? null,
    employment: s.employment,
    tip: s.universalTip ?? null,
    documents: s.documents,
    documentsEs: s.documentsEs,
    unverified: isUnverified(s),
  }))

  const prompt = `You are a strict fact-checker reviewing a draft reply from a government-benefits assistant before it reaches a citizen.

CITIZEN CONTEXT: ${JSON.stringify({ lifeEvent: ctx.lifeEvent, employment: ctx.employment })}
RETRIEVED FACTS (the ONLY things the reply is allowed to claim as fact): ${JSON.stringify(facts)}

CANDIDATE REPLY:
"""
${reply}
"""

This check is about INCORRECT or UNSUPPORTED claims, never about INCOMPLETENESS or PHRASING. A reply that omits a fact (a deadline, an amount, an acknowledgment of the citizen's situation) is NOT a violation — silence is always safe. Only flag the reply for something it actually SAYS that is wrong or unbacked, never for something it fails to mention, and never for HOW it says something it's otherwise entitled to say.

You are judging SUBSTANCE, not PHRASING. Do NOT flag: rewording, paraphrasing, summarizing, reasonable inference from the provided facts, differences in emphasis or level of detail, or tone/transition/empathy language. A reply does not need to restate a fact's full nuance (e.g. "varies by municipality") or use any particular hedge wording — if the substance of a claim is backed by RETRIEVED FACTS, it is SUPPORTED regardless of exact phrasing.

Check TWO things:
1. Every factual claim the reply DOES make — specifically an agency name, a number (cost/amount/deadline/day-count), or an eligibility/document requirement — must be supported by RETRIEVED FACTS above. Flag a claim only if it names an agency, states a number, or asserts an eligibility/document rule that is NOT present in or reasonably inferable from those facts. Do not flag a claim for being reworded, summarized, or missing extra caveats that were present in the source fact but aren't essential to the claim itself.
2. The reply must not CONTRADICT the citizen's own context — e.g. opening with sympathy for a job loss when their actual life event is a new baby, or stating an eligibility rule that contradicts their known employment status. This means asserting something FALSE about their situation — it does NOT mean the reply is required to explicitly mention or acknowledge their life event/employment. A reply that is simply silent about their situation (no opener, no personalization) is NOT a contradiction. Tone, empathy, and personalization style are handled elsewhere and are out of scope for this check.

QUESTIONS ARE NEVER CONTRADICTIONS. If the reply ASKS the citizen something ("do you have a storefront or employees?", "what is the poder for?") instead of asserting it, that question cannot contradict their context — a question has no truth value to check. Only flag rule 2 when the reply STATES something false about the citizen as fact. Also: "employment" (formal/informal/unemployed) describes how the citizen earns income personally — it says NOTHING about the size, structure, or staffing of a business or situation they're asking about. A citizen with "informal" employment can still run a business with a storefront or employees; asking about THAT is not a contradiction of THEIR employment status. Similarly, a general, explicitly conditional rule ("you need X if your assets are $12,000 or more") is not an assertion about this specific citizen's case — it's only a contradiction if the reply drops the condition and asserts the rule applies to them without knowing that yet.

IMPORTANT exception to rule 1: when a fact's "unverified" field is true, the reply is ALLOWED to state an approximate figure AS LONG AS it is clearly hedged in SOME reasonable way (e.g. "about $X — please confirm with [agency]", "reported around N days, verify with the agency", "based on available info", "not confirmed"). ANY phrasing that signals the figure isn't certain counts — do not require a specific hedge template or a named agency inside the hedge itself. A properly hedged estimate for an unverified fact is SUPPORTED, not a violation — only flag it if the reply asserts the figure as certain/definite with NO hedge language at all, or if the stated figure isn't reasonably close to anything mentioned in that fact's own data (name/amount/deadline/tip).

Examples of the SUPPORTED/UNSUPPORTED boundary:
- Facts include {"amount": null, "deadline": "30 days after birth"} and the tip says "domestic use costs about $3-$5, varies by municipality." Reply: "You need the birth certificate. For domestic use it costs about $3 to $5, depending on the municipality." → SUPPORTED. This is a paraphrase of the tip, not a new claim — do not flag it for omitting other details from the tip (like the $20/abroad tier) that the reply didn't need to mention.
- Facts include {"amount": null} with a tip mentioning "$3.50, but this is not confirmed." Reply: "Based on available info, the cost is about $3.50 — please confirm the exact fee with the agency." → SUPPORTED. The hedge doesn't need to match the tip's exact wording or name the specific agency to count as a hedge.
- Facts include {"deadline": "30 days after birth"} and the reply states "you must register within 90 days." → UNSUPPORTED. This is a fabricated number not backed by the facts, not a phrasing difference.
- Facts don't mention any agency named "Ministry of Labor" and the reply states the citizen must also go to the Ministry of Labor. → UNSUPPORTED. This is a fabricated agency/claim.

Be strict and suspicious about claims with NO basis at all in the facts, and about contradictions — if a claim asserts a specific agency, number, or rule that has no reasonable basis in RETRIEVED FACTS, mark it UNSUPPORTED. But do not penalize a reply merely for how it phrases, hedges, or summarizes something that IS backed by the facts — that is correct, desired behavior, not a violation. Return ONLY this JSON, no other text:
{"verdict": "SUPPORTED" or "UNSUPPORTED", "problems": ["<offending claim or contradiction, if any>"]}`

  try {
    const text = (await getLLM().complete(prompt, { temperature: 0.0, maxTokens: 300, json: true })).trim()
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
    if (parsed.verdict === "SUPPORTED") return { ok: true, problems: [] }
    return { ok: false, problems: Array.isArray(parsed.problems) && parsed.problems.length > 0 ? parsed.problems : ["Faithfulness check returned UNSUPPORTED"] }
  } catch (e) {
    console.error("checkFaithfulness failed — failing safe as UNSUPPORTED:", e)
    return { ok: false, problems: ["Faithfulness check could not be completed (parse/API error) — failing safe"] }
  }
}

// ── Orchestrator — deterministic stages first (cheapest first) ──────────
export async function check(
  reply: string,
  retrieved: Service[],
  fullKB: Service[],
  ctx: CitizenContextForGrounding
): Promise<GroundingResult> {
  const entity = checkEntities(reply, retrieved, fullKB)
  if (!entity.ok) return { grounded: false, stage: "entity", problems: entity.problems }

  const value = checkValues(reply, retrieved)
  if (!value.ok) return { grounded: false, stage: "value", problems: value.problems }

  const faithfulness = await checkFaithfulness(reply, retrieved, ctx)
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
