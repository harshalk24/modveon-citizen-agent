import { NextResponse } from "next/server"
import { streamChat, summariseConversation } from "@/lib/ai"
import { buildSystemPrompt } from "@/lib/context-builder"
import { lookupServices } from "@/lib/kb"
import { getSession, incrementTurn, shouldSummarise, getRecentMessages, checkRateLimit } from "@/lib/session"
import { logResponse } from "@/lib/audit"
import { extractCitedServiceIds } from "@/lib/validator"
import { extractLifeEvent, extractEmployment, extractConfirmation } from "@/lib/extract-intent"
import { classifyQuery } from "@/lib/classify-query"
import { canWriteDurable } from "@/lib/confidence"
import { prisma } from "@/lib/prisma"

// Human-readable labels for the confirmation prompt — keys match extractLifeEvent's output.
const LIFE_EVENT_LABELS: Record<string, { en: string; es: string }> = {
  "new-baby":       { en: "you had a new baby",        es: "tuviste un bebé" },
  "job-loss":       { en: "you lost your job",         es: "perdiste tu trabajo" },
  "start-business": { en: "you're starting a business", es: "estás iniciando un negocio" },
  "diaspora":       { en: "you're managing things from abroad", es: "estás gestionando trámites desde el exterior" },
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
            employment: dbCtx.employment       || contextData?.profile?.employment || "any",
            lifeEvent:  dbCtx.lifeEvent        || contextData?.profile?.lifeEvent  || "",
            pendingLifeEvent: dbCtx.pendingLifeEvent || undefined,
            language:   dbCtx.citizen?.language || contextData?.profile?.language  || language,
          },
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
          profile: { firstName: "there", country: "SV", employment: "any", lifeEvent: "", language },
          entitlements: [], planSteps: [], deadlines: [],
          lastUpdated: new Date().toISOString(),
        }
  }

  // ── Intent extraction from the latest user message ─────────────────
  const userMessage: string = messages.findLast((m: any) => m.role === "user")?.content ?? ""

  const detectedEvent      = extractLifeEvent(userMessage)
  const detectedEmployment = extractEmployment(userMessage)
  const isEs               = (ctx.profile.language || language) === "es"

  const isRealCitizen = !!(citizenId && citizenId !== "anonymous")

  // ── Classify query type + confidence — computed once, used both to gate
  // durable writes below and (later) to pick the reply's system-prompt mode. ─
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
  console.log("Query classified as:", classification.type, `(confidence ${classification.confidence})`, "| lifeEvent:", ctx.profile.lifeEvent)

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
      await prisma.deadline.deleteMany({ where: { citizenId, completed: false } })
      await prisma.citizenContext.upsert({
        where: { citizenId },
        create: { citizenId, lifeEvent: pending, pendingLifeEvent: null, entitlementsJson: "[]", updatedAt: new Date() },
        update: { lifeEvent: pending, pendingLifeEvent: null, entitlementsJson: "[]", conversationSummary: null },
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
      const newCandidate = detectedEvent && detectedEvent !== pending && canWriteDurable(classification)
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
      return new Response(msg, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
    }
  } else if (detectedEvent && detectedEvent !== ctx.profile.lifeEvent) {
    if (isRealCitizen) {
      if (!canWriteDurable(classification)) {
        // Low-confidence turn — reply normally, but do not even propose a reset.
        console.log("Reset proposal skipped — confidence below threshold:", classification.confidence)
      } else {
        // Do NOT reset anything on detection alone — stage it and ask for confirmation.
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
        return new Response(msg, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
      }
    } else {
      // Anonymous citizens have no persisted plan/deadlines to protect — just use
      // the detected event for this turn's KB lookup, nothing to confirm or destroy.
      ctx.profile.lifeEvent = detectedEvent
    }
  }

  // Apply employment signal when previously unknown (non-blocking).
  // The in-memory value can still personalize this reply; only the durable
  // write is gated on confidence.
  if (detectedEmployment && ctx.profile.employment === "any") {
    ctx.profile.employment = detectedEmployment
    if (citizenId && citizenId !== "anonymous" && canWriteDurable(classification)) {
      prisma.citizenContext.upsert({
        where: { citizenId },
        create: { citizenId, employment: detectedEmployment, updatedAt: new Date() },
        update: { employment: detectedEmployment },
      }).catch(console.error)
    }
  }

  // ── KB lookup ──────────────────────────────────────────────────────
  const services = ctx.profile.lifeEvent
    ? lookupServices({
        country:    ctx.profile.country    || "SV",
        lifeEvent:  ctx.profile.lifeEvent,
        employment: ctx.profile.employment || "any",
      })
    : []

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
    return new Response(msg, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  // ── System prompt ──────────────────────────────────────────────────
  const recentMsgs   = getRecentMessages(messages, 4)
  const systemPrompt = buildSystemPrompt(ctx, services, JSON.stringify(recentMsgs), language, classification.type)

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

  // ── Stream response ─────────────────────────────────────────────────
  const startTime = Date.now()

  try {
    const stream = await streamChat({
      systemPrompt,
      messages: formattedMessages,
      maxTokens: 600,
    })

    const encoder = new TextEncoder()
    let fullResponse = ""

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream as AsyncIterable<any>) {
            const text = chunk.text()
            fullResponse += text
            controller.enqueue(encoder.encode(text))
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
        "Content-Type":      "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (err) {
    console.error("Chat error:", err)
    return NextResponse.json({ error: "Agent unavailable" }, { status: 500 })
  }
}
