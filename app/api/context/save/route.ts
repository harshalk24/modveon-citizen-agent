import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const { citizenId, lifeEvent, employment, entitlements, planSteps, deadlines } = await req.json()

  if (!citizenId) {
    return NextResponse.json({ error: "citizenId required" }, { status: 400 })
  }

  await prisma.citizenContext.upsert({
    where: { citizenId },
    create: {
      citizenId,
      lifeEvent,
      employment,
      entitlementsJson: JSON.stringify(entitlements || []),
      updatedAt: new Date(),
    },
    update: {
      lifeEvent,
      employment,
      entitlementsJson: JSON.stringify(entitlements || []),
    }
  })

  if (planSteps?.length) {
    await prisma.actionPlan.upsert({
      where: { citizenId },
      create: { citizenId, planJson: JSON.stringify(planSteps) },
      update: { planJson: JSON.stringify(planSteps) }
    })
  }

  if (deadlines?.length) {
    for (const d of deadlines) {
      await prisma.deadline.upsert({
        where: { id: d.id || `${citizenId}-${d.serviceId}` },
        create: {
          id: d.id || `${citizenId}-${d.serviceId}`,
          citizenId,
          title: d.title,
          titleEs: d.titleEs,
          dueDate: new Date(d.dueDate),
          serviceName: d.serviceName,
          serviceId: d.serviceId,
        },
        update: {
          title: d.title,
          titleEs: d.titleEs,
          dueDate: new Date(d.dueDate),
        }
      })
    }
  }

  return NextResponse.json({ ok: true })
}
