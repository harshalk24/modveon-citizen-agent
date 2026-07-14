import { NextResponse } from "next/server"
import { streamChat, summariseConversation } from "@/lib/ai"
import { buildSystemPrompt } from "@/lib/context-builder"
import { situationLabel } from "@/lib/situation-labels"
import { services as fullKB } from "@/lib/kb"
import { retrieveServices } from "@/lib/semantic-search"
import { getActiveSituations, addSituation, removeSituation } from "@/lib/situations"
import { ensureSituationRows, addSituationRow, removeSituationRow, primaryRow, slugsOfRows, updateSituationSlots, updatePrimaryEntitlements, SituationRow } from "@/lib/situation-store"
import { looksHypothetical, extractRemoveSituation } from "@/lib/extract-intent"
import { getSession, incrementTurn, shouldSummarise, getRecentMessages, checkRateLimit } from "@/lib/session"
import { logResponse } from "@/lib/audit"
import { extractCitedServiceIds } from "@/lib/validator"
import { normalizeEmployment } from "@/types/context"
import { classifyQuery } from "@/lib/classify-query"
import { canWriteLifeEvent, canWriteEmployment, canWriteMemoryType } from "@/lib/confidence"
import { check as checkGrounding, buildFallbackReply } from "@/lib/grounding"
import { logGroundingFallback, GroundingAttempt } from "@/lib/grounding-log"
import { applySlotInferences, nextMissingSlot, SLOT_DEFS } from "@/lib/slots"
import { prisma } from "@/lib/prisma"

// Human-readable labels for the "situation added" acknowledgment — keys
// match classifyQuery's lifeEvent output.
const LIFE_EVENT_LABELS: Record<string, { en: string; es: string }> = {
  "new-baby":       { en: "you had a new baby",        es: "tuviste un bebé" },
  "job-loss":       { en: "you lost your job",         es: "perdiste tu trabajo" },
  "start-business": { en: "you're starting a business", es: "estás iniciando un negocio" },
  "diaspora":       { en: "you're managing things from abroad", es: "estás gestionando trámites desde el exterior" },
}

// Tags every reply with WHY it looks the way it does, so the client can pick
// relevant follow-up suggestions from the actual server-side classification
// instead of re-guessing from the reply text (fragile keyword sniffing).
function chatHeaders(uiState: string, hasServices: boolean): Record<string, string> {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "X-UI-State": uiState,
    "X-Has-Services": hasServices ? "1" : "0",
  }
}

export async function POST(req: Request) {
  // Default language to "es" — El Salvador is Spanish-first
  const { messages, citizenId, contextData, sessionId, language = "es" } = await req.json()

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 })
  }

  const allowed = await checkRateLimit(sessionId)
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  await incrementTurn(sessionId)
  const turnCount = (await getSession(sessionId))?.turnCount ?? 1

  // ── Build context — prefer DB record over client-sent contextData ────
  // Reading from DB ensures we have the latest lifeEvent/employment even if
  // the client's React state is stale (e.g. first message after onboarding).
  let ctx: any = null
  // Task 2b-C1: the primary situation's Situation row, once ctx is built from
  // DB — guaranteed non-null whenever ctx.profile.lifeEvent is set (via
  // ensureSituationRows' lazy backfill below), so the slot-filling/
  // entitlements persistence later in this function never needs a fallback
  // branch. Stays null for anonymous/contextData-only requests.
  let primarySituation: ReturnType<typeof primaryRow> = null
  // Task 2b-C2: every active situation's row, kept in scope for the rest of
  // this function — query-relevant slot targeting needs to read/write
  // whichever situation the CURRENT turn is about, not always primary.
  let allSituationRows: SituationRow[] = []
  if (citizenId && citizenId !== "anonymous") {
    try {
      const dbCtx = await prisma.citizenContext.findUnique({
        where: { citizenId },
        include: { citizen: true },
      })
      if (dbCtx) {
        // Situation table (Task 2b-C1) is now the source of truth for
        // concurrent situations — activeLifeEvents/slotsJson/entitlementsJson/
        // pendingSlot on CitizenContext are left in place but unused (reversible
        // migration; see prisma/schema.prisma). Lazily backfills a row for any
        // citizen whose only situation predates row-backing (onboarding/
        // profile-edit paths still write CitizenContext.lifeEvent directly).
        const situationRows = await ensureSituationRows(citizenId, {
          lifeEvent: dbCtx.lifeEvent,
          slotsJson: dbCtx.slotsJson,
          entitlementsJson: dbCtx.entitlementsJson,
          pendingSlot: dbCtx.pendingSlot,
        })
        allSituationRows = situationRows
        primarySituation = primaryRow(situationRows)
        ctx = {
          citizenId,
          profile: {
            firstName:  contextData?.profile?.firstName || dbCtx.citizen?.firstName || "there",
            country:    dbCtx.citizen?.country || contextData?.profile?.country || "SV",
            employment: normalizeEmployment(dbCtx.employment || contextData?.profile?.employment),
            lifeEvent:  dbCtx.lifeEvent        || contextData?.profile?.lifeEvent  || "",
            // Phase 2a: source of truth for concurrent situations — read
            // through getActiveSituations() everywhere, never parsed ad hoc.
            // Phase 2b-C1: derived from Situation rows, not the DB column.
            activeLifeEvents: JSON.stringify(slugsOfRows(situationRows)),
            pendingLifeEvent: dbCtx.pendingLifeEvent || undefined,
            language:   dbCtx.citizen?.language || contextData?.profile?.language  || language,
            municipality: dbCtx.municipality || contextData?.profile?.municipality || undefined,
          },
          slots:               JSON.parse(primarySituation?.slotsJson || "{}"),
          pendingSlot:         primarySituation?.pendingSlot || undefined,
          entitlements:        JSON.parse(primarySituation?.entitlementsJson || "[]"),
          planSteps:           [],
          deadlines:           [],
          conversationSummary: dbCtx.conversationSummary || undefined,
          lastUpdated:         dbCtx.updatedAt.toISOString(),
        }
      }
    } catch (e) {
      console.error("DB context read failed:", e)
    }
  }
  if (!ctx) {
    ctx = contextData
      ? { ...contextData, profile: { ...contextData.profile } }
      : {
          citizenId: citizenId || "anonymous",
          profile: { firstName: "there", country: "SV", employment: "unknown", lifeEvent: "", language },
          entitlements: [], planSteps: [], deadlines: [],
          lastUpdated: new Date().toISOString(),
        }
  }

  // ── Intent extraction from the latest user message ─────────────────
  const userMessage: string = messages.findLast((m: any) => m.role === "user")?.content ?? ""
  const isEs               = (ctx.profile.language || language) === "es"

  const isRealCitizen = !!(citizenId && citizenId !== "anonymous")

  // Hoisted above the classifier call (Phase 2a/2b) — classifyQuery needs the
  // actual situation names, not just the collapsed hasLifeEvent boolean; see
  // its own comment for why. Reused unchanged by the situation-change flow below.
  const activeSituations = getActiveSituations(ctx.profile)

  // Task 2b-C1: current compat state for addSituationRow/removeSituationRow's
  // own ensureSituationRows call — built from ctx (already resolved from the
  // primary Situation row, or the compat fallback, during ctx-building above).
  const compatCtx = {
    lifeEvent:        ctx.profile.lifeEvent || null,
    slotsJson:        JSON.stringify(ctx.slots || {}),
    entitlementsJson: JSON.stringify(ctx.entitlements || []),
    pendingSlot:      ctx.pendingSlot || null,
  }

  // ── Classify query type + life event + employment, each with its own
  // confidence — computed once, used both to gate durable writes below and
  // (later) to pick the reply's system-prompt mode. The classifier is the
  // source of truth for detection; extract-intent.ts's keyword matchers are
  // otherwise only used client-side (no server round-trip available there) —
  // looksHypothetical below is the one exception, a deterministic backstop
  // for the situation-add decision specifically.
  const recentTurns = messages
    .slice(-4)
    .map((m: any) => `${m.role}: ${(m.content as string).slice(0, 120)}`)
    .join("\n")
  const classification = await classifyQuery({
    message:             userMessage,
    hasLifeEvent:        !!ctx.profile.lifeEvent,
    hasEntitlements:     (ctx.entitlements?.length || 0) > 0,
    conversationHistory: recentTurns,
    activeSituations,
  })
  const detectedEvent      = classification.lifeEvent
  const detectedEmployment = classification.employment !== "unknown" ? classification.employment : null
  console.log("[DIAG] classify:", JSON.stringify({ type: classification.type, lifeEvent: classification.lifeEvent, detected: detectedEvent }))
  console.log(
    "Query classified as:", classification.type, `(confidence ${classification.confidence})`,
    "| lifeEvent:", detectedEvent, `(confidence ${classification.lifeEventConfidence})`,
    "| employment:", classification.employment, `(confidence ${classification.employmentConfidence})`,
    "| memoryType:", classification.memoryType, `(confidence ${classification.memoryTypeConfidence})`,
    "| stored lifeEvent:", ctx.profile.lifeEvent,
  )

  // ── Memory signal (Task 4) ──────────────────────────────────────────
  // "durable" doesn't get its own write path — it connects to the existing
  // lifeEvent/employment gates below, which are the actual durable writes.
  // This is logged here purely for observability; canWriteLifeEvent/
  // canWriteEmployment (not memoryType) are what actually govern those writes.
  if (classification.memoryType === "durable" && canWriteMemoryType(classification)) {
    console.log("memoryType=durable — routes to the existing lifeEvent/employment write gates below, no separate write path")
  }
  // "episodic" has no store yet (deferred to Task 9) — log only.
  if (classification.memoryType === "episodic" && canWriteMemoryType(classification)) {
    console.log("[episodic-event]", { citizenId, message: userMessage, confidence: classification.memoryTypeConfidence })
    // TODO(task 9): persist episodic event — no episodic store exists yet.
  }
  // "discard"/"session" → intentionally no code here; the absence of a write is correct.

  // Apply employment signal whenever the classifier detects one — not just the
  // first time (a citizen losing a formal job later must be able to update it).
  // This runs BEFORE the life-event confirmation flow below (which can return
  // early) so employment is never dropped just because a life-event proposal
  // was also raised or declined in the same turn — the two facets are independent.
  // Employment eligibility hinges on formal vs informal being exact, so a
  // low-confidence guess is not even used to personalize this turn's KB
  // lookup — it's fully gated, not just the durable write.
  if (detectedEmployment && detectedEmployment !== ctx.profile.employment && canWriteEmployment(classification)) {
    ctx.profile.employment = detectedEmployment
    if (citizenId && citizenId !== "anonymous") {
      console.log("Durable profile write (employment) — memoryType:", classification.memoryType, classification.memoryTypeConfidence)
      prisma.citizenContext.upsert({
        where: { citizenId },
        create: { citizenId, employment: detectedEmployment, updatedAt: new Date() },
        update: { employment: detectedEmployment },
      }).catch(console.error)
    }
  }

  // ── Situation-change flow: ALWAYS-ADD, never propose/wipe (Phase 2a) ────
  // A newly-detected situation is appended to the citizen's active list
  // immediately — never proposed-and-confirmed, never a reason to reset
  // slots/entitlements/deadlines. detectedEvent is already gated to real
  // declarations (classify-query.ts's #10 hypothetical carve-out nulls it
  // for "what if…"/"can I…" phrasing), so reaching here means the citizen
  // genuinely stated a new situation. See lib/situations.ts.
  // (activeSituations was already computed above, before the classifier call.)

  // ── Situation-REMOVE safety valve (Phase 2a Step 6) ─────────────────
  // Deliberately a rough, functional-only affordance (per the task doc) —
  // an explicit removal verb naming one of the citizen's actually-active
  // situations, not real NLU. Checked before the add flow below so a
  // removal command is never also misread as declaring a new situation.
  // Re-narrows retrieval/plan automatically on the next turn since both
  // read through getActiveSituations(ctx.profile), same funnel as the add path.
  const removalSlug = extractRemoveSituation(userMessage, activeSituations)
  if (removalSlug) {
    // Task 2b-C1: real citizens persist through the Situation-row funnel
    // (deletes the row); anonymous sessions have nothing to delete, so they
    // still use the pure in-memory transform for this request's reply only.
    const next = isRealCitizen
      ? await removeSituationRow(citizenId, removalSlug, compatCtx)
      : removeSituation({ activeLifeEvents: activeSituations, lifeEvent: ctx.profile.lifeEvent || null }, removalSlug)
    ctx.profile.lifeEvent = next.lifeEvent || ""
    ctx.profile.activeLifeEvents = JSON.stringify(next.activeLifeEvents)
    if (isRealCitizen) {
      console.log("Durable profile write (situation removed):", removalSlug, "— still active:", next.activeLifeEvents)
    }
    const removedLabel = situationLabel(removalSlug, isEs ? "es" : "en")
    const remainingLabels = next.activeLifeEvents.map(s => situationLabel(s, isEs ? "es" : "en"))
    const msg = isEs
      ? `Listo, quité ${removedLabel}.${remainingLabels.length ? ` Todavía tenés ${remainingLabels.join(" y ")}.` : ""}`
      : `Removed ${removedLabel}.${remainingLabels.length ? ` You still have ${remainingLabels.join(" and ")}.` : ""}`
    return new Response(msg, { headers: chatHeaders("situation-removed", true) })
  }

  // Deterministic backstop: the classifier's hypothetical carve-out is
  // reliable in isolation but has been observed to misfire once ANY prior
  // conversation history exists (confirmed live — "What if I lost my job?"
  // can come back as a real job-loss declaration mid-conversation even
  // though the same message with no history correctly nulls out). An added
  // situation is a durable write, so veto it here regardless of what the
  // classifier said — see lib/extract-intent.ts's looksHypothetical.
  const isHypotheticalPhrasing = looksHypothetical(userMessage)
  if (detectedEvent && isHypotheticalPhrasing) {
    console.log("Situation add skipped — message reads as hypothetical despite classifier lifeEvent:", detectedEvent)
  }
  if (detectedEvent && !isHypotheticalPhrasing && !activeSituations.includes(detectedEvent)) {
    if (!canWriteLifeEvent(classification)) {
      // Low-confidence turn — reply normally, do not even add yet.
      console.log("Situation add skipped — lifeEventConfidence below threshold:", classification.lifeEventConfidence)
    } else {
      // Task 2b-C1: real citizens persist through the Situation-row funnel
      // (upserts a new active row, lazy-backfilling any pre-row-backing
      // situation alongside it); anonymous sessions have nothing to persist,
      // so they still use the pure in-memory transform for this reply only.
      const next = isRealCitizen
        ? await addSituationRow(citizenId, detectedEvent, compatCtx)
        : addSituation({ activeLifeEvents: activeSituations, lifeEvent: ctx.profile.lifeEvent || null }, detectedEvent)
      ctx.profile.lifeEvent = next.lifeEvent || ""
      ctx.profile.activeLifeEvents = JSON.stringify(next.activeLifeEvents)
      // Deliberately NOT touching ctx.entitlements/ctx.slots/ctx.pendingSlot or
      // deleting deadlines — an add is additive. Entitlements become the union
      // once services are recomputed below (retrieveServices unions across
      // every active situation); the existing plan/deadlines stay valid until
      // the next "Open plan" regenerates the merged plan (Step 5).
      if (isRealCitizen) {
        console.log("Durable profile write (situation added):", detectedEvent, "— now active:", next.activeLifeEvents)
      }
      const addedLabel = LIFE_EVENT_LABELS[detectedEvent]
      const allLabels = next.activeLifeEvents.map(s => situationLabel(s, isEs ? "es" : "en"))
      const msg = isEs
        ? `Agregado: ${addedLabel?.es || "tu nueva situación"} — ahora tenés ${allLabels.join(" y ")}.`
        : `Added ${addedLabel?.en || "your new situation"} — you now have ${allLabels.join(" and ")}.`
      return new Response(msg, { headers: chatHeaders("situation-added", true) })
    }
  }

  // ── Slot-filling: FILL (Task 2b-C2 — query-relevant target) ──────────
  // Decision-relevant facts, now per-situation (Task 2b-C1's rows) — a
  // citizen can have more than one open pendingSlot at once (one per
  // situation), so this tries EVERY active situation's open pendingSlot,
  // not just a single shared one. Target-mapping rule 1 (classifier-
  // detected life event, gated by the same confidence threshold as the
  // situation-add decision) is available before retrieval and used here
  // only to ORDER which situation's extract() is tried first — extract()
  // is slot-specific and returns null for a non-matching message, so trying
  // the "wrong" situation first is harmless (it just fails to parse, same
  // as an unrelated message always has). Rule 2 (retrieval-based) is a
  // fallback that needs retrieval's result, so it's only used for the ASK
  // decision below, after retrieveServices runs.
  const classifierTargetSlug = (detectedEvent && activeSituations.includes(detectedEvent) && canWriteLifeEvent(classification))
    ? detectedEvent
    : null
  const fillOrder = [
    ...allSituationRows.filter(r => r.lifeEvent === classifierTargetSlug),
    ...allSituationRows.filter(r => r.lifeEvent !== classifierTargetSlug),
  ]
  for (const row of fillOrder) {
    if (!row.pendingSlot) continue
    const pendingDef = (SLOT_DEFS[row.lifeEvent] || []).find(d => d.key === row.pendingSlot)
    const answer = pendingDef?.extract(userMessage) ?? null
    if (answer === null) continue // doesn't parse as THIS situation's answer — leave it open, try the next
    const filled = applySlotInferences(row.lifeEvent, { ...JSON.parse(row.slotsJson || "{}"), [row.pendingSlot]: answer })
    row.slotsJson = JSON.stringify(filled)
    row.pendingSlot = null
    if (isRealCitizen) {
      await updateSituationSlots(citizenId, row.lifeEvent, row.slotsJson, null)
    }
  }
  // Merged view across every active situation, for retrieval/the system
  // prompt — slot KEYS are namespaced per lifeEvent by SLOT_DEFS convention
  // (e.g. "businessSizeTier" only exists under start-business), so merging
  // never collides across situations.
  ctx.slots = allSituationRows.reduce((acc, row) => ({ ...acc, ...JSON.parse(row.slotsJson || "{}") }), {} as Record<string, string>)

  // ── KB lookup (query-scoped semantic retrieval, augmenting the situation
  // lookup rather than replacing it — see lib/semantic-search.ts) ─────────
  const retrieval = await retrieveServices({
    country:    ctx.profile.country    || "SV",
    lifeEvents: getActiveSituations(ctx.profile),
    employment: ctx.profile.employment || "unknown",
    slots:      ctx.slots,
    query:      userMessage,
    queryType:  classification.type,
    lang:       language as "en" | "es",
  })
  const services = retrieval.services
  console.log("[DIAG] retrieval:", JSON.stringify({ fg: retrieval.foregroundCount, miss: retrieval.isHonestMiss, services: retrieval.services.map(s => ({ id: s.id, src: s._source })) }))

  // ── Slot-filling: ASK (Task 2b-C2 — query-relevant target) ───────────
  // Which situation is THIS turn about, for the purpose of deciding what to
  // ASK? Rule 1 reuses the classifier target computed above (FILL's
  // ordering hint doubles as this rule). Rule 2, only reached when rule 1
  // didn't resolve a target (e.g. an ordinary follow-up about an existing
  // situation, not a new declaration): the retrieval foreground's top match
  // — the KB entry this turn's semantic match actually surfaced — carries
  // which situation(s) it belongs to; if that intersects an active
  // situation, target = that situation. No match on either rule → no
  // target (a generic/unmapped turn) — per Decision 1, ask NOTHING rather
  // than pester about some unrelated situation's slot; do not fall back to
  // asking on the primary or any other situation just because one exists.
  let askTargetSlug: string | null = classifierTargetSlug
  if (!askTargetSlug) {
    const topForeground = services.find(s => s._source === "foreground" || s._source === "both")
    askTargetSlug = topForeground?._situations?.find(s => activeSituations.includes(s)) || null
  }
  const targetRow = askTargetSlug ? allSituationRows.find(r => r.lifeEvent === askTargetSlug) || null : null

  // Decide the single most-decisive missing slot for THIS turn, scoped to
  // the target situation only (rule 3: one question at a time, never batch,
  // never about a situation the turn isn't even about) — null when there's
  // no target or the target has nothing missing, so the system prompt gets
  // no slot instruction and asks nothing (test #6).
  const slotToAsk = targetRow ? nextMissingSlot(targetRow.lifeEvent, JSON.parse(targetRow.slotsJson || "{}")) : null
  if (isRealCitizen && targetRow) {
    const newPendingSlot = slotToAsk?.key || null
    if (newPendingSlot !== targetRow.pendingSlot) {
      await updateSituationSlots(citizenId, targetRow.lifeEvent, targetRow.slotsJson, newPendingSlot)
    }
  }

  // ── Persist entitlements (awaited — ensures Dashboard reads fresh data) ─
  // Entitlements are the citizen's ONGOING SITUATION benefits (the Dashboard's
  // concept) — a one-off topical match (_source "foreground" only, e.g. asking
  // about a home loan with no housing situation established) must not get
  // silently promoted into a standing entitlement, so it's excluded here even
  // though it's included in `services` for answering/grounding this turn.
  const entitlementServices = services.filter(s => s._source !== "foreground")
  if (entitlementServices.length > 0 && isRealCitizen && primarySituation) {
    const entitlements = entitlementServices.map(s => ({
      serviceId: s.id,
      status:    "new",
      savedAt:   new Date().toISOString(),
    }))
    ctx.entitlements = entitlements
    // Task 2b-C1: entitlements persist to the PRIMARY situation's row now,
    // not the shared CitizenContext field — lifeEvent/employment are already
    // kept current by their own dedicated write paths above (addSituationRow/
    // removeSituationRow, and the employment-write block), so this spot only
    // ever needs to touch entitlementsJson.
    await updatePrimaryEntitlements(citizenId, primarySituation.lifeEvent, JSON.stringify(entitlements))
  }

  // ── Out-of-scope guard — return immediately, no LLM call ───────────
  if (classification.type === "out-of-scope") {
    const msg = isEs
      ? "Solo puedo ayudarte con trámites y beneficios del gobierno de El Salvador. ¿Hay algo relacionado con eso en lo que pueda ayudarte?"
      : "I can only help with El Salvador government services and benefits. Is there something related I can help you with?"
    return new Response(msg, { headers: chatHeaders("out-of-scope", false) })
  }

  // ── System prompt ──────────────────────────────────────────────────
  if (classification.type === "no-context-open") {
    console.log("[DIAG] situation-gathering branch fired | lifeEvent(singular) =", ctx.profile.lifeEvent, "| active =", getActiveSituations(ctx.profile), "| type =", classification.type)
  }
  const recentMsgs   = getRecentMessages(messages, 4)
  const systemPrompt = buildSystemPrompt(ctx, services, JSON.stringify(recentMsgs), language, classification.type, slotToAsk, retrieval.isHonestMiss)

  // Format for Gemini — strip leading model turns
  const formattedMessages = messages
    .map((m: any) => ({ role: m.role === "assistant" ? "model" : m.role, parts: m.content }))

  // ── Async summarisation every N turns ──────────────────────────────
  if (shouldSummarise(turnCount) && messages.length > 0 && citizenId && citizenId !== "anonymous") {
    summariseConversation(messages, language).then(async (summary) => {
      await prisma.citizenContext.upsert({
        where:  { citizenId },
        create: { citizenId, conversationSummary: summary, updatedAt: new Date() },
        update: { conversationSummary: summary },
      }).catch(console.error)
    }).catch(console.error)
  }

  // ── Generate fully → ground → stream ────────────────────────────────
  // Safety over latency: the reply is generated and fact-checked in full
  // BEFORE anything reaches the citizen, rather than streaming tokens as
  // they're produced. This is the only place an LLM-authored, potentially
  // hallucinated reply reaches the citizen — the canned short-circuit
  // responses above (out-of-scope, reset-guard prompts) are fixed strings,
  // not generated text, so they don't need grounding.
  const startTime = Date.now()

  async function generateFull(prompt: string): Promise<{ text: string; chunks: string[] }> {
    const stream = await streamChat({
      systemPrompt: prompt,
      messages: formattedMessages,
      maxTokens: 600,
    })
    const chunks: string[] = []
    for await (const chunk of stream as AsyncIterable<any>) {
      chunks.push(chunk.text())
    }
    return { text: chunks.join(""), chunks }
  }

  const citizenCtxForGrounding = { lifeEvents: getActiveSituations(ctx.profile), employment: ctx.profile.employment }

  try {
    let generated = await generateFull(systemPrompt)
    let groundingOutcome: "grounded" | "regenerated" | "fell-back" = "grounded"
    let lastResult: Awaited<ReturnType<typeof checkGrounding>> = { grounded: true }
    // Task M1 — measurement only. Captures each attempt's draft BEFORE it's
    // overwritten/discarded below, so a fallback can be hand-judged later
    // (legit catch vs. over-strict judge). Never read by the decision logic
    // itself — groundingOutcome/lastResult/generated are computed exactly as
    // before; this array is purely a side observation.
    const attempts: GroundingAttempt[] = []

    // Nothing concrete to fact-check when no services were retrieved (e.g.
    // pure onboarding conversation) — skip the extra LLM round-trip.
    if (services.length > 0 && classification.type !== "meta") {
      lastResult = await checkGrounding(generated.text, services, fullKB, citizenCtxForGrounding, language)
      attempts.push({ attempt: 1, draft: generated.text, stage: lastResult.stage, reasons: lastResult.problems, passed: lastResult.grounded })

      if (!lastResult.grounded) {
        console.warn("Grounding failed (attempt 1):", lastResult.stage, lastResult.problems)
        const regenPrompt = `${systemPrompt}\n\nIMPORTANT: your previous draft made these unsupported or incorrect claims: ${JSON.stringify(lastResult.problems)}. Rewrite your reply using ONLY the facts in the KNOWLEDGE BASE section above. For every entry with review="needs_review" or a low conf, you MUST include an explicit hedge phrase directly next to its specific figures — e.g. "this varies by source — confirm with [agency]" — not just avoid stating a number. Do not repeat these mistakes.`
        const regenerated = await generateFull(regenPrompt)
        const regenResult = await checkGrounding(regenerated.text, services, fullKB, citizenCtxForGrounding, language)
        attempts.push({ attempt: 2, draft: regenerated.text, stage: regenResult.stage, reasons: regenResult.problems, passed: regenResult.grounded })

        if (regenResult.grounded) {
          generated = regenerated
          groundingOutcome = "regenerated"
        } else {
          console.warn("Grounding failed (attempt 2 — regeneration):", regenResult.stage, regenResult.problems)
          const criticalSlotAsk = slotToAsk?.critical ? slotToAsk.ask : null
          generated = { text: buildFallbackReply(services, language as "en" | "es", criticalSlotAsk), chunks: [] }
          generated.chunks = [generated.text]
          groundingOutcome = "fell-back"
          lastResult = regenResult
        }
      }
    }

    const { text: fullResponse, chunks } = generated
    console.log("Grounding outcome:", groundingOutcome, groundingOutcome !== "grounded" ? { stage: lastResult.stage, problems: lastResult.problems } : "")

    // Task M1 — fire-and-forget, only for non-first-try turns (see lib/grounding-log.ts).
    if (groundingOutcome !== "grounded") {
      logGroundingFallback({
        citizenId: isRealCitizen ? citizenId : undefined,
        sessionId,
        query: userMessage,
        attempts,
        outcome: groundingOutcome,
        finalReply: fullResponse,
      })
    }

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk))
          }
        } finally {
          controller.close()
          logResponse({
            citizenId,
            sessionId,
            prompt:      userMessage,
            response:    fullResponse,
            kbSourceIds: extractCitedServiceIds(fullResponse),
            latencyMs:   Date.now() - startTime,
          })
        }
      }
    })

    return new Response(readable, {
      headers: {
        // hasServices reflects situation-worthy material (same set used for
        // entitlements), not raw foreground hits — a one-off topical match
        // with no established situation has nothing for "Open plan" to open.
        ...chatHeaders(classification.type, entitlementServices.length > 0),
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (err) {
    console.error("Chat error:", err)
    return NextResponse.json({ error: "Agent unavailable" }, { status: 500 })
  }
}
