import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { flattenPlanSteps, rebuildPlanFromSteps } from "@/lib/plan-shape"

export async function PATCH(req: Request) {
  const body = await req.json()
  const { citizenId, serviceId, completed } = body
  // Accept `phase` (current) or legacy `week` from clients mid-transition.
  const phase = body.phase ?? body.week

  if (!citizenId || !serviceId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const plan = await prisma.actionPlan.findUnique({ where: { citizenId } })
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const raw = JSON.parse(plan.planJson)
  const steps = flattenPlanSteps(raw)
  const updated = steps.map(s => {
    const matches = s.serviceId === serviceId && (phase === undefined || s.phase === phase)
    return matches
      ? { ...s, status: completed ? "done" : "not-started", completedAt: completed ? new Date().toISOString() : undefined }
      : s
  })

  await prisma.actionPlan.update({
    where: { citizenId },
    data: { planJson: JSON.stringify(rebuildPlanFromSteps(raw, updated)) }
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

  const raw = JSON.parse(plan.planJson)
  const steps = flattenPlanSteps(raw)
  const filtered = steps.filter(s => s.serviceId !== serviceId)

  await prisma.actionPlan.update({
    where: { citizenId },
    data: { planJson: JSON.stringify(rebuildPlanFromSteps(raw, filtered)) }
  })

  // Remove associated deadline if any
  await prisma.deadline.deleteMany({ where: { citizenId, serviceId } })

  return NextResponse.json({ ok: true })
}
