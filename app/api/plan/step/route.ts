import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request) {
  const { citizenId, serviceId, completed } = await req.json()

  if (!citizenId || !serviceId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const plan = await prisma.actionPlan.findUnique({ where: { citizenId } })
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const steps = JSON.parse(plan.planJson) as any[]
  const updated = steps.map((s: any) =>
    s.serviceId === serviceId
      ? { ...s, status: completed ? "done" : "not-started", completedAt: completed ? new Date().toISOString() : undefined }
      : s
  )

  await prisma.actionPlan.update({
    where: { citizenId },
    data: { planJson: JSON.stringify(updated) }
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { citizenId, serviceId } = await req.json()

  if (!citizenId || !serviceId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const plan = await prisma.actionPlan.findUnique({ where: { citizenId } })
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const steps = JSON.parse(plan.planJson) as any[]
  const filtered = steps.filter((s: any) => s.serviceId !== serviceId)

  await prisma.actionPlan.update({
    where: { citizenId },
    data: { planJson: JSON.stringify(filtered) }
  })

  // Remove associated deadline if any
  await prisma.deadline.deleteMany({ where: { citizenId, serviceId } })

  return NextResponse.json({ ok: true })
}
