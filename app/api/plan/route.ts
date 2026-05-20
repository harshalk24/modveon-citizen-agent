import { NextResponse } from "next/server"
import { generatePlan } from "@/lib/ai"
import { validatePlanJSON } from "@/lib/validator"
import { prisma } from "@/lib/prisma"

async function savePlanToDB(
  citizenId: string,
  validatedPlan: { weeks: any[] },
  services: any[],
  lifeEvent?: string
) {
  // Store the full { weeks: [...] } structure so the plan page gets week labels
  await prisma.actionPlan.upsert({
    where:  { citizenId },
    create: { citizenId, planJson: JSON.stringify(validatedPlan), lifeEvent: lifeEvent || null },
    update: { planJson: JSON.stringify(validatedPlan), lifeEvent: lifeEvent || null },
  })

  // Create deadline records for steps that have deadlineDays
  for (const week of validatedPlan.weeks) {
    for (const step of week.steps) {
      const svc = services.find((s: any) => s.id === step.serviceId)
      if (svc?.deadlineDays) {
        const existing = await prisma.deadline.findFirst({
          where: { citizenId, serviceId: step.serviceId },
        })
        if (!existing) {
          await prisma.deadline.create({
            data: {
              citizenId,
              serviceId:   step.serviceId,
              title:       step.title,
              titleEs:     step.title,
              dueDate:     new Date(Date.now() + svc.deadlineDays * 24 * 60 * 60 * 1000),
              serviceName: step.agency,
            },
          })
        }
      }
    }
  }
}

export async function POST(req: Request) {
  const { citizenId, services, profile, language = "es" } = await req.json()

  if (!services || !profile) {
    return NextResponse.json({ error: "Missing services or profile" }, { status: 400 })
  }

  // Don't generate plans for anonymous sessions — no place to save them
  if (!citizenId || citizenId === "anonymous") {
    return NextResponse.json({ error: "citizenId required to generate plan" }, { status: 400 })
  }

  // Compact services before sending to Gemini — full KB objects are large and
  // inflate the prompt unnecessarily.  Keep only what the plan template needs.
  const compactServices = (services as any[]).map(s => ({
    id:         s.id,
    name:       language === "es" ? (s.nameEs || s.name) : s.name,
    agency:     s.agency,
    sourceUrl:  s.sourceUrl || s.applyUrl,
    documents:  language === "es" ? (s.documentsEs || s.documents) : s.documents,
    deadline:   s.deadline  || null,
    deadlineDays: s.deadlineDays || null,
    dependsOn:  s.dependsOn || [],
  }))

  try {
    const result = await generatePlan({ services: compactServices, profile, language })
    console.log("Plan generated, validating...")
    const validation = validatePlanJSON(JSON.stringify(result))
    console.log("Plan validation:", validation.valid ? "OK" : validation.error)

    if (!validation.valid) {
      console.log("Plan invalid, retrying...")
      const retry = await generatePlan({ services: compactServices, profile, language })
      const retryValidation = validatePlanJSON(JSON.stringify(retry))
      console.log("Plan retry validation:", retryValidation.valid ? "OK" : retryValidation.error)

      if (!retryValidation.valid) {
        // Fallback: build a minimal plan directly from the compact service list
        const fallback = {
          weeks: [{
            week:  1,
            label: language === "es" ? "Semana 1 — Hacé esto primero" : "Week 1 — Do these first",
            steps: compactServices.slice(0, 3).map((s: any) => ({
              serviceId:              s.id,
              title:                  s.name,
              agency:                 s.agency,
              agencyAddress:          s.sourceUrl,
              deadline:               s.deadline || null,
              estimatedTime:          language === "es" ? "30 minutos en persona" : "30 minutes in person",
              cost:                   "Free",
              documents:              s.documents || [],
              whatToSayWhenYouArrive: language === "es"
                ? `Hola, vengo a tramitar ${s.name}.`
                : `Hi, I'm here to apply for ${s.name}.`,
              whatToDoIfProblems:     language === "es"
                ? `Contactá a ${s.agency} directamente en ${s.sourceUrl}`
                : `Contact ${s.agency} directly at ${s.sourceUrl}`,
              canDoOnline: false,
              onlineUrl:   null,
              why:         language === "es" ? "Prioridad alta" : "High priority",
            })),
          }],
        }
        await savePlanToDB(citizenId, fallback, compactServices, profile?.lifeEvent)
        return NextResponse.json(fallback)
      }

      await savePlanToDB(citizenId, retryValidation.parsed, compactServices, profile?.lifeEvent)
      return NextResponse.json(retryValidation.parsed)
    }

    await savePlanToDB(citizenId, validation.parsed, compactServices, profile?.lifeEvent)
    return NextResponse.json(validation.parsed)
  } catch (err: any) {
    console.error("Plan generation error:", err)
    // Return the actual error message so the client can surface it for debugging
    return NextResponse.json(
      { error: "Plan generation failed", detail: err?.message ?? String(err) },
      { status: 500 }
    )
  }
}
