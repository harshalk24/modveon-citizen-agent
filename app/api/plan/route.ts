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
  // Flatten weeks → steps with week number for storage
  const flatSteps = validatedPlan.weeks.flatMap((w: any) =>
    w.steps.map((s: any) => ({ ...s, week: w.week, status: "not-started" }))
  )

  await prisma.actionPlan.upsert({
    where: { citizenId },
    create: { citizenId, planJson: JSON.stringify(flatSteps), lifeEvent: lifeEvent || null },
    update: { planJson: JSON.stringify(flatSteps), lifeEvent: lifeEvent || null },
  })

  // Create deadline records for steps that have a deadline
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
              serviceId: step.serviceId,
              title: step.title,
              titleEs: step.title,
              dueDate: new Date(Date.now() + svc.deadlineDays * 24 * 60 * 60 * 1000),
              serviceName: step.agency,
            },
          })
        }
      }
    }
  }
}

export async function POST(req: Request) {
  const { citizenId, services, profile, language = "en" } = await req.json()

  if (!services || !profile) {
    return NextResponse.json({ error: "Missing services or profile" }, { status: 400 })
  }

  try {
    const result = await generatePlan({ services, profile, language })
    console.log("Plan generated, validating...")
    const validation = validatePlanJSON(JSON.stringify(result))
    console.log("Plan validation:", validation.valid ? "OK" : validation.error)

    if (!validation.valid) {
      console.log("Plan invalid, retrying...")
      const retry = await generatePlan({ services, profile, language })
      const retryValidation = validatePlanJSON(JSON.stringify(retry))
      console.log("Plan retry validation:", retryValidation.valid ? "OK" : retryValidation.error)

      if (!retryValidation.valid) {
        // Fallback: entitlements-only plan
        const fallback = {
          weeks: [{
            week: 1,
            label: language === "es" ? "Semana 1" : "Week 1",
            steps: services.slice(0, 3).map((s: any) => ({
              serviceId: s.id,
              title: language === "es" ? s.nameEs : s.name,
              agency: s.agency,
              agencyAddress: s.sourceUrl,
              deadline: s.deadline || null,
              estimatedTime: language === "es" ? "30 minutos en persona" : "30 minutes in person",
              cost: "Free",
              documents: language === "es" ? s.documentsEs : s.documents,
              whatToSayWhenYouArrive: language === "es"
                ? `Hola, vengo a tramitar ${s.nameEs}.`
                : `Hi, I'm here to apply for ${s.name}.`,
              whatToDoIfProblems: language === "es"
                ? `Contactá a ${s.agency} directamente en ${s.sourceUrl}`
                : `Contact ${s.agency} directly at ${s.sourceUrl}`,
              canDoOnline: false,
              onlineUrl: null,
              why: language === "es" ? "Prioridad alta" : "High priority",
            }))
          }]
        }
        if (citizenId && citizenId !== "anonymous") {
          await savePlanToDB(citizenId, fallback, services, profile?.lifeEvent)
        }
        return NextResponse.json(fallback)
      }

      if (citizenId && citizenId !== "anonymous") {
        await savePlanToDB(citizenId, retryValidation.parsed, services, profile?.lifeEvent)
      }
      return NextResponse.json(retryValidation.parsed)
    }

    if (citizenId && citizenId !== "anonymous") {
      await savePlanToDB(citizenId, validation.parsed, services, profile?.lifeEvent)
    }
    return NextResponse.json(validation.parsed)
  } catch (err) {
    console.error("Plan generation error:", err)
    return NextResponse.json({ error: "Plan generation failed" }, { status: 500 })
  }
}
