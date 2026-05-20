import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CitizenContextData } from "@/types/context"

export async function GET(req: Request) {
  const citizenId = req.headers.get("x-citizen-id")
  if (!citizenId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const citizen = await prisma.citizen.findUnique({
    where: { id: citizenId },
    include: {
      context: true,
      actionPlan: true,
      // Fetch ALL deadlines — completed ones are needed for the "deadlines met" progress bar
      deadlines: true,
    },
  })

  if (!citizen) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ctx = citizen.context
  const plan = citizen.actionPlan

  const data: CitizenContextData = {
    citizenId: citizen.id,
    profile: {
      firstName: citizen.firstName || "there",
      country: citizen.country,
      employment: ctx?.employment || "any",
      lifeEvent: ctx?.lifeEvent || "",
      language: (citizen.language as "en" | "es") || "es",
      email: citizen.email || undefined,
      gender: citizen.gender || undefined,
    },
    entitlements: ctx?.entitlementsJson ? JSON.parse(ctx.entitlementsJson) : [],
    // planJson may be stored as flat array (old format) or { weeks: [...] } (new format).
    // Always return a flat array with a `week` property on each step so the plan page
    // can group them with groupStepsByWeek().
    planSteps: (() => {
      if (!plan?.planJson) return []
      const parsed = JSON.parse(plan.planJson)
      if (Array.isArray(parsed)) return parsed   // old flat format
      if (parsed?.weeks) {
        // New { weeks: [...] } format — flatten, adding week number to each step
        return parsed.weeks.flatMap((w: any) =>
          (w.steps || []).map((s: any) => ({ ...s, week: w.week, status: s.status || "not-started" }))
        )
      }
      return []
    })(),
    deadlines: citizen.deadlines.map(d => ({
      serviceId: d.serviceId,
      title: d.title,
      titleEs: d.titleEs,
      dueDate: d.dueDate.toISOString(),
      completed: d.completed,
      reminded30: d.reminded30,
      reminded7: d.reminded7,
      reminded1: d.reminded1,
    })),
    conversationSummary: ctx?.conversationSummary || undefined,
    lastUpdated: citizen.updatedAt.toISOString(),
    planUpdatedAt: plan?.updatedAt?.toISOString(),
    planLifeEvent: (plan as any)?.lifeEvent || undefined,
  }

  return NextResponse.json(data)
}
