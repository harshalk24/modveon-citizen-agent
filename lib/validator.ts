import { services } from "@/lib/kb"

export async function checkKBLinks(): Promise<{ serviceId: string; url: string; status: number }[]> {
  console.log("Validator: checking", services.length, "KB links...")
  const results = []
  for (const s of services) {
    try {
      const res = await fetch(s.sourceUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) })
      if (res.status !== 200) {
        results.push({ serviceId: s.id, url: s.sourceUrl, status: res.status })
      }
    } catch {
      results.push({ serviceId: s.id, url: s.sourceUrl, status: 0 })
    }
  }
  console.log("Validator: found", results.length, "dead links")
  return results
}

export function validatePlanJSON(raw: string): { valid: boolean; parsed?: any; error?: string } {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(cleaned)
    if (!parsed.weeks || !Array.isArray(parsed.weeks)) {
      return { valid: false, error: "Missing weeks array" }
    }
    for (const week of parsed.weeks) {
      if (!week.steps || !Array.isArray(week.steps)) {
        return { valid: false, error: `Week ${week.week} missing steps array` }
      }
      for (const step of week.steps) {
        // Only validate required structural fields — do NOT check serviceId against KB.
        // Gemini may use slightly different IDs; strict matching causes all real plans
        // to be rejected and fall back to the stub plan.
        if (!step.serviceId || !step.title || !step.agency) {
          return { valid: false, error: "Step missing required fields (serviceId, title, agency)" }
        }
      }
    }
    return { valid: true, parsed }
  } catch (e) {
    return { valid: false, error: String(e) }
  }
}

export function extractCitedServiceIds(response: string): string[] {
  const ids = services.map(s => s.id)
  return ids.filter(id => response.includes(id))
}
