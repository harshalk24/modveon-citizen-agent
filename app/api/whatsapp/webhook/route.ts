import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { lookupServices } from "@/lib/kb"
import { streamChat } from "@/lib/ai"
import { buildSystemPrompt } from "@/lib/context-builder"
import { sendWhatsAppMessage } from "@/lib/whatsapp"

export async function POST(req: Request) {
  const formData = await req.formData()
  const from = (formData.get("From") as string)?.replace("whatsapp:", "")
  const body = (formData.get("Body") as string)?.trim()

  if (!from || !body) return new Response("OK", { status: 200 })

  const normalized = body.toLowerCase()

  if (normalized === "yes" || normalized === "sí" || normalized === "si") {
    const citizen = await prisma.citizen.findFirst({
      where: { id: from },
      include: {
        deadlines: {
          where: { completed: false },
          orderBy: { dueDate: "asc" },
          take: 1
        }
      }
    })
    if (citizen?.deadlines[0]) {
      await prisma.deadline.update({
        where: { id: citizen.deadlines[0].id },
        data: { completed: true }
      })
      await sendWhatsAppMessage(from, `Great! I marked "${citizen.deadlines[0].title}" as completed.`)
      return new Response("OK", { status: 200 })
    }
  }

  if (normalized === "no") {
    await sendWhatsAppMessage(from, "Got it. I'll remind you in 3 days. If you need help now, tell me which process you need help with.")
    return new Response("OK", { status: 200 })
  }

  const lowerBody = body.toLowerCase().trim()

  // Handle D+1 follow-up replies
  if (lowerBody === "tuve problemas" || lowerBody === "had problems") {
    const citizen = await prisma.citizen.findFirst({ where: { id: from } })
    const recentDeadline = await prisma.deadline.findFirst({
      where: {
        citizenId: citizen?.id,
        reminded1: true,
        completed: false,
      },
      orderBy: { dueDate: "desc" },
    })
    if (recentDeadline) {
      const isEs = (citizen as any)?.language !== "en"
      const msg = isEs
        ? `Entendido. Contame qué pasó cuando intentaste "${recentDeadline.titleEs}" — te ayudo a resolverlo.`
        : `Got it. Tell me what happened when you tried to complete "${recentDeadline.title}" — I'll help you resolve it.`
      await sendWhatsAppMessage(from, msg)
      return new Response("OK", { status: 200 })
    }
  }

  if (
    lowerBody === "no pude ir todavía" ||
    lowerBody === "no pude ir" ||
    lowerBody === "couldn't make it yet" ||
    lowerBody === "couldn't make it"
  ) {
    const citizen = await prisma.citizen.findFirst({ where: { id: from } })
    const isEs = (citizen as any)?.language !== "en"
    const msg = isEs
      ? `Sin problema. ¿Cuándo podés ir? Decime la fecha y te mando un recordatorio el día anterior.`
      : `No problem. When can you go? Tell me the date and I'll send you a reminder the day before.`
    await sendWhatsAppMessage(from, msg)
    return new Response("OK", { status: 200 })
  }

  const citizen = await prisma.citizen.findFirst({
    where: { id: from },
    include: { context: true }
  })

  const ctx = citizen?.context
  const services = ctx?.lifeEvent
    ? lookupServices({ country: "SV", lifeEvent: ctx.lifeEvent, employment: ctx.employment || "any" })
    : []

  const systemPrompt = buildSystemPrompt(
    {
      citizenId: citizen?.id || "unknown",
      profile: {
        firstName: citizen?.firstName || "there",
        country: "SV",
        employment: ctx?.employment || "any",
        lifeEvent: ctx?.lifeEvent || "",
        language: ((citizen?.language ?? undefined) as "en" | "es" | undefined) || "en"
      },
      entitlements: [],
      planSteps: [],
      deadlines: [],
      conversationSummary: ctx?.conversationSummary ?? undefined,
      lastUpdated: new Date().toISOString(),
    },
    services,
    body,
    (citizen?.language as "en" | "es") || "en"
  )

  let fullResponse = ""
  const stream = await streamChat({
    systemPrompt,
    messages: [{ role: "user", parts: body }],
    maxTokens: 400,
  })

  for await (const chunk of stream as AsyncIterable<any>) {
    fullResponse += chunk.text()
  }

  const plainText = fullResponse
    .replace(/\*\*/g, "*")
    .replace(/#{1,3} /g, "")

  await sendWhatsAppMessage(from, plainText)
  return new Response("OK", { status: 200 })
}
