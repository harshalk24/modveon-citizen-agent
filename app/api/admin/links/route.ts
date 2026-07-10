import { NextResponse } from "next/server"
import { checkKBLinks } from "@/lib/validator"
import { services } from "@/lib/kb"

export async function GET() {
  const report = await checkKBLinks()
  console.log("Link check results — dead:", report.dead, "inconclusive:", report.inconclusive)
  return NextResponse.json({
    total: services.length,
    ok: report.okCount,
    deadCount: report.dead.length,
    inconclusiveCount: report.inconclusive.length,
    allClear: report.dead.length === 0,
    dead: report.dead,
    // "Needs a human glance, likely fine" — a 403/timeout/etc. is NOT evidence
    // the page is dead; a WAF or JS/cookie challenge can't be defeated by a
    // plain fetch. Never treat this list as broken links.
    inconclusive: report.inconclusive,
  })
}
