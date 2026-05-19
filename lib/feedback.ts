import { prisma } from "@/lib/prisma"

export async function saveFeedback(params: {
  citizenId?: string
  serviceId?: string
  messageId?: string
  type: "wrong-info" | "dead-link" | "missing-service" | "other"
  note?: string
}) {
  return await prisma.feedback.create({ data: params })
}

export async function getUnresolvedFeedback() {
  return await prisma.feedback.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "desc" }
  })
}

export async function resolveFeedback(id: string) {
  return await prisma.feedback.update({
    where: { id },
    data: { resolved: true }
  })
}
