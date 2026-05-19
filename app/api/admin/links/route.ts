import { NextResponse } from "next/server"
import { checkKBLinks } from "@/lib/validator"
import { services } from "@/lib/kb"

export async function GET() {
  const deadLinks = await checkKBLinks()
  console.log("Link check results:", deadLinks)
  return NextResponse.json({
    total: services.length,
    dead: deadLinks.length,
    allLive: deadLinks.length === 0,
    results: deadLinks,
  })
}
