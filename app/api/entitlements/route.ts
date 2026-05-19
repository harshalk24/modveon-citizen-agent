import { NextResponse } from "next/server"
import { lookupServices } from "@/lib/kb"

export async function POST(req: Request) {
  const { lifeEvent, employment, country } = await req.json()

  if (!lifeEvent || !employment || !country) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const services = lookupServices({ country, lifeEvent, employment })
  return NextResponse.json({ services })
}
