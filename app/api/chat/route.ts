import { NextResponse } from "next/server"
import { streamChat, summariseConversation } from "@/lib/ai"
import { buildSystemPrompt } from "@/lib/context-builder"
import { lookupServices, services as fullKB } from "@/lib/kb"
import { getSession, incrementTurn, shouldSummarise, getRecentMessages, checkRateLimit } from "@/lib/session"
import { logResponse } from "@/lib/audit"
import { extractCitedServiceIds } from "@/lib/validator"
import { extractConfirmation } from "@/lib/extract-intent"
import { normalizeEmployment } from "@/types/context"
import { classifyQuery } from "@/lib/classify-query"
import { canWriteLifeEvent, canWriteEmployment, canWriteMemoryType } from "@/lib/confidence"
import { check as checkGrounding, buildFallbackReply } from "@/lib/grounding"
import { logGroundingFallback, GroundingAttempt } from "@/lib/grounding-log"
import { applySlotInferences, nextMissingSlot, SLOT_DEFS } from "@/lib/slots"
import { prisma } from "@/lib/prisma"

// Human-readable labels for the confirmation prompt — keys match classifyQuery's lifeEvent output.
const LIFE_EVENT_LABELS: Record<string, { en: string; es: string }> = {
  "new-baby":       { en: "you had a new baby",        es: "tuviste un bebé" },
  "job-loss":       { en: "you lost your job",         es: "perdiste tu trabajo" },
  "start-business": { en: "you're starting a business", es: "estás iniciando un negocio" },
  "diaspora":       { en: "you're managing things from abroad", es: "estás gestionando trámites desde el exterior" },
}

// Tags every reply with WHY it looks the way it does, so the client can pick
// relevant follow-up suggestions from the actual server-side classification
// instead of re-guessing from the reply text (fragile keyword sniffing).
// "confirming" covers both pendingLifeEvent branches — hasServices is true
// there because, by construction, that branch only fires when an existing
// lifeEvent/plan already exists (the message literally protects it).
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
  if (citizenId && citizenId !== "anonymous") {
    try {
      const dbCtx = await prisma.citizenContext.findUnique({
        where: { citizenId },
        include: { citizen: true },
      })
      if (dbCtx) {
        ctx = {
          citizenId,
          profile: {
            firstName:  contextData?.profile?.firstName || dbCtx.citizen?.firstName || "there",
            country:    dbCtx.citizen?.country || contextData?.profile?.country || "SV",
            employment: normalizeEmployment(dbCtx.employment || contextData?.profile?.employment),
            lifeEvent:  dbCtx.lifeEvent        || contextData?.profile?.lifeEvent  || "",
            pendingLifeEvent: dbCtx.pendingLifeEvent || undefined,
            language:   dbCtx.citizen?.language || contextData?.profile?.language  || language,
            municipality: dbCtx.municipality || contextData?.profile?.municipality || undefined,
          },
          slots:               JSON.parse((dbCtx.slotsJson as string) || "{}"),
          pendingSlot:         dbCtx.pendingSlot || undefined,
          entitlements:        JSON.parse((dbCtx.entitlementsJson as string) || "[]"),
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

  // ── Classify query type + life event + employment, each with its own
  // confidence — computed once, used both to gate durable writes below and
  // (later) to pick the reply's system-prompt mode. The classifier is now the
  // source of truth for detection; extract-intent.ts's keyword matchers are
  // only used client-side (no server round-trip available there).
  const recentTurns = messages
    .slice(-4)
    .map((m: any) => `${m.role}: ${(m.content as string).slice(0, 120)}`)
    .join("\n")
  const classification = await classifyQuery({
    message:             userMessage,
    hasLifeEvent:        !!ctx.profile.lifeEvent,
    hasEntitlements:     (ctx.entitlements?.length || 0) > 0,
    conversationHistory: recentTurns,
  })
  const detectedEvent      = classification.lifeEvent
  const detectedEmployment = classification.employment !== "unknown" ? classification.employment : null
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

  if (isRealCitizen && ctx.profile.pendingLifeEvent) {
    // A candidate life-event change is awaiting citizen confirmation.
    const pending   = ctx.profile.pendingLifeEvent
    const confirmed = extractConfirmation(userMessage)

    if (confirmed === "yes") {
      // Only now — with explicit confirmation — perform the destructive reset.
      // ActionPlan is left alone; /api/plan overwrites it (upsert) once the new
      // plan is generated, so we never delete it before a replacement exists.
      ctx.profile.lifeEvent        = pending
      ctx.profile.pendingLifeEvent = undefined
      ctx.entitlements = []
      // New situation, clean slate — slots gathered for the OLD situation
      // don't apply to the new one (Task S1: slots are per-current-situation,
      // not episodic history).
      ctx.slots = {}
      ctx.pendingSlot = undefined
      await prisma.deadline.deleteMany({ where: { citizenId, completed: false } })
      await prisma.citizenContext.upsert({
        where: { citizenId },
        create: { citizenId, lifeEvent: pending, pendingLifeEvent: null, entitlementsJson: "[]", slotsJson: "{}", pendingSlot: null, updatedAt: new Date() },
        update: { lifeEvent: pending, pendingLifeEvent: null, entitlementsJson: "[]", conversationSummary: null, slotsJson: "{}", pendingSlot: null },
      })
    } else if (confirmed === "no") {
      ctx.profile.pendingLifeEvent = undefined
      await prisma.citizenContext.upsert({
        where: { citizenId },
        create: { citizenId, pendingLifeEvent: null, updatedAt: new Date() },
        update: { pendingLifeEvent: null },
      })
    } else {
      // Ambiguous reply — re-ask instead of guessing either way. If the citizen
      // mentioned yet another different situation, update the pending candidate
      // instead of silently holding onto the stale one — but only on a
      // confident classification; a low-confidence turn must not overwrite it.
      const newCandidate = detectedEvent && detectedEvent !== pending && canWriteLifeEvent(classification)
        ? detectedEvent
        : pending
      if (newCandidate !== pending) {
        ctx.profile.pendingLifeEvent = newCandidate
        await prisma.citizenContext.upsert({
          where: { citizenId },
          create: { citizenId, pendingLifeEvent: newCandidate, updatedAt: new Date() },
          update: { pendingLifeEvent: newCandidate },
        })
      }
      const newLabel = LIFE_EVENT_LABELS[newCandidate]
      const msg = newLabel
        ? (isEs
            ? `Todavía no confirmaste: ¿${newLabel.es} y querés que empiece un plan nuevo? Tu plan actual se mantiene hasta que confirmes.`
            : `I still need to confirm: should I start a new plan because ${newLabel.en}? Your current plan will be kept until you confirm.`)
        : (isEs
            ? "¿Confirmás que querés empezar un plan nuevo? Tu plan actual se mantiene hasta que confirmes."
            : "Can you confirm you'd like to start a new plan? Your current plan will be kept until you confirm.")
      return new Response(msg, { headers: chatHeaders("confirming", true) })
    }
  } else if (detectedEvent && detectedEvent !== ctx.profile.lifeEvent) {
    if (isRealCitizen) {
      if (!canWriteLifeEvent(classification)) {
        // Low-confidence turn — reply normally, but do not even propose a reset.
        console.log("Reset proposal skipped — lifeEventConfidence below threshold:", classification.lifeEventConfidence)
      } else {
        // Do NOT reset anything on detection alone — stage it and ask for confirmation.
        console.log("Durable profile write (pendingLifeEvent proposal) — memoryType:", classification.memoryType, classification.memoryTypeConfidence)
        ctx.profile.pendingLifeEvent = detectedEvent
        await prisma.citizenContext.upsert({
          where: { citizenId },
          create: { citizenId, pendingLifeEvent: detectedEvent, updatedAt: new Date() },
          update: { pendingLifeEvent: detectedEvent },
        })
        const label = LIFE_EVENT_LABELS[detectedEvent]
        const msg = isEs
          ? `Parece que tu situación cambió: ${label?.es || "algo cambió"}. ¿Querés que empiece un plan nuevo? Tu plan actual se mantiene hasta que confirmes.`
          : `It sounds like your situation changed — ${label?.en || "something changed"}. Should I start a new plan? Your current plan will be kept until you confirm.`
        return new Response(msg, { headers: chatHeaders("confirming", true) })
      }
    } else {
      // Anonymous citizens have no persisted plan/deadlines to protect — just use
      // the detected event for this turn's KB lookup, nothing to confirm or destroy.
      ctx.profile.lifeEvent = detectedEvent
      ctx.slots = {}
      ctx.pendingSlot = undefined
    }
  }

  // ── Slot-filling (Task S1) ───────────────────────────────────────────
  // Decision-relevant facts for the CURRENT situation only (not episodic
  // history — see lib/slots.ts). If the last turn asked about a specific
  // slot, try to parse this turn's message as its answer FIRST — a
  // deterministic keyword match is the gate (same reliability tier the
  // codebase already trusts extractConfirmation for a destructive
  // pendingLifeEvent commit); no match leaves the slot open, nothing invented.
  ctx.slots = ctx.slots || {}
  let slotWritten = false
  if (ctx.profile.lifeEvent && ctx.pendingSlot) {
    const pendingDef = (SLOT_DEFS[ctx.profile.lifeEvent] || [])
      .find((d) => d.key === ctx.pendingSlot)
    const answer = pendingDef?.extract(userMessage) ?? null
    if (answer !== null) {
      ctx.slots[ctx.pendingSlot] = answer
      ctx.pendingSlot = undefined
      slotWritten = true
    }
  }
  if (ctx.profile.lifeEvent) {
    ctx.slots = applySlotInferences(ctx.profile.lifeEvent, ctx.slots)
  }

  // ── KB lookup ──────────────────────────────────────────────────────
  const services = ctx.profile.lifeEvent
    ? lookupServices({
        country:    ctx.profile.country    || "SV",
        lifeEvent:  ctx.profile.lifeEvent,
        employment: ctx.profile.employment || "unknown",
        slots:      ctx.slots,
      })
    : []

  // Decide the single most-decisive missing slot for THIS turn (rule 3: one
  // question at a time, never batch) — null when nothing's missing, so the
  // system prompt gets no slot instruction and asks nothing (test #6).
  const slotToAsk = ctx.profile.lifeEvent ? nextMissingSlot(ctx.profile.lifeEvent, ctx.slots) : null
  const newPendingSlot = slotToAsk?.key
  if (isRealCitizen && (slotWritten || newPendingSlot !== ctx.pendingSlot)) {
    ctx.pendingSlot = newPendingSlot
    await prisma.citizenContext.upsert({
      where: { citizenId },
      create: { citizenId, slotsJson: JSON.stringify(ctx.slots), pendingSlot: newPendingSlot || null, updatedAt: new Date() },
      update: { slotsJson: JSON.stringify(ctx.slots), pendingSlot: newPendingSlot || null },
    })
  } else {
    ctx.pendingSlot = newPendingSlot
  }

  // ── Persist entitlements (awaited — ensures Dashboard reads fresh data) ─
  if (services.length > 0 && citizenId && citizenId !== "anonymous") {
    const entitlements = services.map(s => ({
      serviceId: s.id,
      status:    "new",
      savedAt:   new Date().toISOString(),
    }))
    ctx.entitlements = entitlements
    await prisma.citizenContext.upsert({
      where: { citizenId },
      create: {
        citizenId,
        lifeEvent:        ctx.profile.lifeEvent,
        employment:       ctx.profile.employment,
        entitlementsJson: JSON.stringify(entitlements),
        updatedAt:        new Date(),
      },
      update: {
        entitlementsJson: JSON.stringify(entitlements),
        lifeEvent:        ctx.profile.lifeEvent,
        employment:       ctx.profile.employment,
      },
    })
  }

  // ── Out-of-scope guard — return immediately, no LLM call ───────────
  if (classification.type === "out-of-scope") {
    const msg = isEs
      ? "Solo puedo ayudarte con trámites y beneficios del gobierno de El Salvador. ¿Hay algo relacionado con eso en lo que pueda ayudarte?"
      : "I can only help with El Salvador government services and benefits. Is there something related I can help you with?"
    return new Response(msg, { headers: chatHeaders("out-of-scope", false) })
  }

  // ── System prompt ──────────────────────────────────────────────────
  const recentMsgs   = getRecentMessages(messages, 4)
  const systemPrompt = buildSystemPrompt(ctx, services, JSON.stringify(recentMsgs), language, classification.type, slotToAsk)

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

  const citizenCtxForGrounding = { lifeEvent: ctx.profile.lifeEvent, employment: ctx.profile.employment }

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
        ...chatHeaders(classification.type, services.length > 0),
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (err) {
    console.error("Chat error:", err)
    return NextResponse.json({ error: "Agent unavailable" }, { status: 500 })
  }
}
