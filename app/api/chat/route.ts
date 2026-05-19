import { NextResponse } from "next/server"
import { streamChat, summariseConversation } from "@/lib/ai"
import { buildSystemPrompt } from "@/lib/context-builder"
import { lookupServices } from "@/lib/kb"
import { getSession, incrementTurn, shouldSummarise, getRecentMessages, checkRateLimit } from "@/lib/session"
import { logResponse } from "@/lib/audit"
import { extractCitedServiceIds } from "@/lib/validator"
import { extractLifeEvent, extractEmployment } from "@/lib/extract-intent"
import { classifyQuery } from "@/lib/classify-query"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const { messages, citizenId, contextData, sessionId, language = "en" } = await req.json()

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 })
  }

  const allowed = await checkRateLimit(sessionId)
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  await incrementTurn(sessionId)
  const turnCount = (await getSession(sessionId))?.turnCount ?? 1

  // Build mutable context from what the client sent
  const ctx = contextData
    ? { ...contextData, profile: { ...contextData.profile } }
    : {
        citizenId: citizenId || "anonymous",
        profile: { firstName: "there", country: "SV", employment: "any", lifeEvent: "", language },
        entitlements: [],
        planSteps: [],
        deadlines: [],
        lastUpdated: new Date().toISOString(),
      }

  // ── Intent extraction from the latest user message ─────────────────
  const userMessage: string = messages.findLast((m: any) => m.role === "user")?.content ?? ""

  const detectedEvent      = extractLifeEvent(userMessage)
  const detectedEmployment = extractEmployment(userMessage)

  // When a NEW life event is detected that differs from current, reset context,
  // delete stale plan + deadlines, and clear conversation summary.
  if (detectedEvent && detectedEvent !== ctx.profile.lifeEvent) {
    ctx.profile.lifeEvent = detectedEvent
    ctx.entitlements = []
    if (citizenId && citizenId !== "anonymous") {
      await prisma.actionPlan.deleteMany({ where: { citizenId } })
      await prisma.deadline.deleteMany({ where: { citizenId, completed: false } })
      await prisma.citizenContext.upsert({
        where: { citizenId },
        create: { citizenId, lifeEvent: detectedEvent, entitlementsJson: "[]", updatedAt: new Date() },
        update: {
          lifeEvent: detectedEvent,
          entitlementsJson: "[]",
          conversationSummary: null,   // reset summary — it belongs to old situation
        },
      })
    }
  }

  // Apply employment signal when previously unknown (non-blocking persist)
  if (detectedEmployment && ctx.profile.employment === "any") {
    ctx.profile.employment = detectedEmployment
    if (citizenId && citizenId !== "anonymous") {
      prisma.citizenContext.upsert({
        where: { citizenId },
        create: { citizenId, employment: detectedEmployment, updatedAt: new Date() },
        update: { employment: detectedEmployment },
      }).catch(console.error)
    }
  }

  // Always re-run KB lookup after any intent extraction
  const services = ctx.profile.lifeEvent
    ? lookupServices({
        country:    ctx.profile.country    || "SV",
        lifeEvent:  ctx.profile.lifeEvent,
        employment: ctx.profile.employment || "any",
      })
    : []

  // ── Persist entitlements so the Dashboard can read them ─────────────
  // Fire-and-forget — don't block the stream.
  if (services.length > 0 && citizenId && citizenId !== "anonymous") {
    const entitlements = services.map(s => ({
      serviceId: s.id,
      status: "new",
      savedAt: new Date().toISOString(),
    }))
    ctx.entitlements = entitlements
    prisma.citizenContext.upsert({
      where: { citizenId },
      create: {
        citizenId,
        lifeEvent:        ctx.profile.lifeEvent,
        employment:       ctx.profile.employment,
        entitlementsJson: JSON.stringify(entitlements),
        updatedAt:        new Date(),
      },
      update: { entitlementsJson: JSON.stringify(entitlements) },
    }).catch(console.error)
  }

  // ── Classify query type using Gemini (intent, not keywords) ─────────
  const hasEntitlements = (ctx.entitlements?.length || 0) > 0
  const recentTurns = messages
    .slice(-4)
    .map((m: any) => `${m.role}: ${(m.content as string).slice(0, 120)}`)
    .join("\n")
  const queryType = await classifyQuery({
    message:             userMessage,
    hasLifeEvent:        !!ctx.profile.lifeEvent,
    hasEntitlements,
    conversationHistory: recentTurns,
  })
  console.log("Query classified as:", queryType, "| lifeEvent:", ctx.profile.lifeEvent)

  // ── System prompt + recent messages ────────────────────────────────
  const recentMsgs   = getRecentMessages(messages, 4)
  const systemPrompt = buildSystemPrompt(ctx, services, JSON.stringify(recentMsgs), language, queryType)

  // Format for Gemini — strip leading model turns (Gemini requires user-first history)
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
      maxTokens: 500,
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
        "Content-Type":     "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (err) {
    console.error("Chat error:", err)
    return NextResponse.json({ error: "Agent unavailable" }, { status: 500 })
  }
}
