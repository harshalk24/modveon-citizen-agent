import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request) {
  const citizenId = req.headers.get("x-citizen-id")
  if (!citizenId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { firstName, email, gender, language, lifeEvent, employment, whatsappNumber, municipality } = await req.json()

  await prisma.citizen.update({
    where: { id: citizenId },
    data: { firstName, email, gender, language }
  })

  if (lifeEvent || employment || municipality) {
    await prisma.citizenContext.upsert({
      where: { citizenId },
      create: { citizenId, lifeEvent, employment, municipality, updatedAt: new Date() },
      update: { lifeEvent, employment, municipality }
    })
  }

  return NextResponse.json({ ok: true })
}
