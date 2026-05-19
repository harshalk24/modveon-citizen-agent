import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const { firstName, country, email, gender, language } = await req.json()

  const citizen = await prisma.citizen.create({
    data: {
      firstName,
      country: country || "SV",
      email,
      gender,
      language: language || "en",
      onboarded: true,
    }
  })

  return NextResponse.json({ citizenId: citizen.id, citizen })
}
