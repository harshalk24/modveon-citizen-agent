import { NextResponse } from "next/server"
import { lookupServicesDB } from "@/lib/kb"

export async function POST(req: Request) {
  const { lifeEvent, employment, country } = await req.json()

  if (!lifeEvent || !employment || !country) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Uses live Supabase KB when available, falls back to static data
  const services = await lookupServicesDB({ country, lifeEvent, employment })
  return NextResponse.json({ services })
}
