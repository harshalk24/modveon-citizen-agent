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
