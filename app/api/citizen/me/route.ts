import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CitizenContextData } from "@/types/context"

export async function GET(req: Request) {
  const citizenId = req.headers.get("x-citizen-id")
  if (!citizenId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const citizen = await prisma.citizen.findUnique({
    where: { id: citizenId },
    include: { context: true, actionPlan: true, deadlines: true }
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
      language: (citizen.language as "en" | "es") || "en",
      email: citizen.email || undefined,
    },
    entitlements: ctx?.entitlementsJson ? JSON.parse(ctx.entitlementsJson) : [],
    planSteps: plan?.planJson ? JSON.parse(plan.planJson) : [],
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
