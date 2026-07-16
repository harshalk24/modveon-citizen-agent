import { getLLM } from "@/lib/llm"
import type { CrawlResult } from "./crawler"

// ── SUPPLEMENTARY DOMAIN BLOCKLIST ────────────────────
// These sites are used ONLY as knowledge sources for scraping.
// Users must NEVER be linked to them — they are not government services.
const SUPPLEMENTARY_DOMAINS = [
  "consuladodelsalvador.com",
  "simple.sv",
  "diasporasv.com",
]

// Agency root fallbacks — used when Gemini can't find a .gob.sv URL in content
const AGENCY_ROOTS: Record<string, string> = {
  ISSS:          "https://www.isss.gob.sv",
  RNPN:          "https://www.rnpn.gob.sv",
  INCAF:         "https://www.incaf.gob.sv",
  CONAMYPE:      "https://www.conamype.gob.sv",
  CNR:           "https://www.cnr.gob.sv",
  Hacienda:      "https://www.mh.gob.sv",
  MTPS:          "https://www.mtps.gob.sv",
  RREES:         "https://rree.gob.sv",
  "Ciudad Mujer":"https://ciudadmujer.presidencia.gob.sv",
  FOSALUD:       "https://www.fosalud.gob.sv",
  BANDESAL:      "https://www.bandesal.gob.sv",
  ANDA:          "https://www.anda.gob.sv",
  "Diaspora Info":"https://rree.gob.sv",   // Consulado info maps to RREES for users
  "Simple SV":   "https://www.gob.sv",
}

/**
 * Guarantees official_link never points to a supplementary site or a login portal.
 * This is a hard code-level guard — it runs after LLM extraction and cannot be
 * bypassed by prompt drift.
 */
function sanitizeOfficialLink(
  extractedLink: string | undefined,
  agency: string | undefined,
  isSupplementary: boolean,
  sourceUrl: string
): string {
  const link = extractedLink?.trim() ?? ""

  // 1. If Gemini left it blank, use agency root
  if (!link) {
    return (agency && AGENCY_ROOTS[agency]) ?? "https://www.gob.sv"
  }

  // 2. If link points to a supplementary site — only block if the SOURCE
  //    is NOT that same supplementary site. If consulado is both the source
  //    AND the only link available (no .gob.sv found), allow it — it's the
  //    only reference the user has for that procedure.
  const isBlockedDomain = SUPPLEMENTARY_DOMAINS.some((d) => link.includes(d))
  if (isBlockedDomain) {
    const sourceIsAlsoSupplementary = SUPPLEMENTARY_DOMAINS.some((d) => sourceUrl.includes(d))
    if (sourceIsAlsoSupplementary) {
      // Consulado page → consulado link: allow as last resort (no .gob.sv exists)
      console.warn(`[Extractor] Supplementary link allowed (no .gob.sv alternative): ${link}`)
      return link
    }
    // Non-supplementary source linking to consulado: always block
    const fallback = (agency && AGENCY_ROOTS[agency]) ?? "https://www.gob.sv"
    console.warn(
      `[Extractor] Blocked supplementary domain in official_link: ${link} → replaced with ${fallback}`
    )
    return fallback
  }

  // 3. If link points to login.gob.sv SSO portal — use agency root instead
  if (link.includes("login.gob.sv")) {
    const fallback = (agency && AGENCY_ROOTS[agency]) ?? "https://www.gob.sv"
    console.warn(
      `[Extractor] Blocked login portal in official_link: ${link} → replaced with ${fallback}`
    )
    return fallback
  }

  // 4. If this is a supplementary source page and the link is relative or
  //    somehow still on the supplementary domain (double check)
  if (isSupplementary) {
    const sourceDomain = SUPPLEMENTARY_DOMAINS.find((d) => sourceUrl.includes(d))
    if (sourceDomain && link.includes(sourceDomain)) {
      const fallback = (agency && AGENCY_ROOTS[agency]) ?? "https://www.gob.sv"
      console.warn(
        `[Extractor] Supplementary source URL leaked into official_link: ${link} → ${fallback}`
      )
      return fallback
    }
  }

  return link
}

export interface ExtractedScheme {
  scheme_name: string
  scheme_name_es: string
  agency: string
  agency_full: string
  country: string
  life_events: string[]
  employment_types: string[]
  description: string
  description_es: string
  eligibility: string
  eligibility_es: string
  documents_required: string[]
  documents_required_es: string[]
  steps: string[]
  steps_es: string[]
  deadline_days: number | null
  amount: string | null
  office_hours: string | null
  official_link: string
  confidence: number
  is_supplementary: boolean
  raw_source_url: string
  extracted_at: string
}

export async function extractSchemes(
  crawlResult: CrawlResult
): Promise<ExtractedScheme[]> {
  // Trim to fit context window — 8000 chars covers most pages
  const content = crawlResult.markdown.slice(0, 8000)

  const prompt = `You are extracting government service information from a scraped El Salvador government website page.

URL: ${crawlResult.url}
Agency: ${crawlResult.agency}
Title: ${crawlResult.title ?? "Unknown"}
Is supplementary (non-official) source: ${crawlResult.isSupplementary}

PAGE CONTENT:
${content}

Extract ALL government services, benefits, or schemes mentioned. For each return structured data.

Rules:
- If a field is not found, use null (not empty string)
- life_events: only use values from this exact list:
  "new-baby", "job-loss", "start-business", "diaspora", "housing", "healthcare",
  "marriage", "death", "retirement", "driving-license", "property", "education",
  "separation", "social-benefits", "any"
- employment_types: only use values from this list:
  "employed", "self-employed", "unemployed", "informal", "any"
- confidence: 0.0–1.0. Be conservative — only give 0.9+ if the page is clearly about this scheme
- If supplementary/non-official source, set confidence no higher than 0.7
- official_link: MUST be an official government URL (.gob.sv or official agency domain).
  If this page is a supplementary/non-official source (e.g. consuladodelsalvador.com, simple.sv),
  find the .gob.sv link mentioned in the page content — never use the supplementary site's own URL.
  If no .gob.sv URL appears in the content, use the most relevant agency root (e.g. "https://www.isss.gob.sv").
  Never set official_link to a login portal URL (login.gob.sv) — use the pre-login service page instead.
- IGNORE navigation elements, menu items, login buttons, download links, and generic page sections. Only extract actual citizen-facing services or benefits with eligibility criteria.
- A valid scheme must have at minimum: a name, who it's for, and what the citizen needs to do or receives. If any of these are missing from the page content, do not extract it.
- Minimum description length: 2 sentences. If you cannot write 2 sentences about what this service does and who qualifies, it is not a real scheme.
- IGNORE internal administrative systems, compliance tools, anti-corruption portals, payroll systems, or anything that is not directly accessible and usable by a regular citizen. If the service requires the user to be a government employee or institution, do not extract it.

Return ONLY valid JSON array, no markdown, no preamble:
[
  {
    "scheme_name": "string",
    "scheme_name_es": "string",
    "agency": "string (short)",
    "agency_full": "string (full name)",
    "country": "SV",
    "life_events": ["string"],
    "employment_types": ["string"],
    "description": "string (English, 1-2 sentences)",
    "description_es": "string (Spanish, 1-2 sentences)",
    "eligibility": "string",
    "eligibility_es": "string",
    "documents_required": ["string"],
    "documents_required_es": ["string"],
    "steps": ["string"],
    "steps_es": ["string"],
    "deadline_days": null or number,
    "amount": null or "string",
    "office_hours": null or "string",
    "official_link": "string",
    "confidence": 0.0 to 1.0
  }
]

If no schemes found: []`

  try {
    const text = await getLLM().complete(prompt, { temperature: 0.1, maxTokens: 8192, json: true })
    const cleaned = text.replace(/```json|```/g, "").trim()

    // Robust parse: if the JSON is truncated (model hit token limit mid-array),
    // recover all complete objects by trimming to the last closing brace.
    let parsed: unknown[]
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Find the last complete JSON object and close the array
      const lastBrace = cleaned.lastIndexOf("}")
      if (lastBrace === -1) {
        console.warn(`Extraction: no valid JSON objects in response for ${crawlResult.url}`)
        return []
      }
      const recovered = cleaned.slice(0, lastBrace + 1)
      const openBracket = recovered.indexOf("[")
      const partial = openBracket !== -1 ? recovered.slice(openBracket) + "]" : "[" + recovered + "]"
      try {
        parsed = JSON.parse(partial)
        console.warn(`Extraction: recovered ${(parsed as unknown[]).length} scheme(s) from truncated JSON for ${crawlResult.url}`)
      } catch {
        console.error(`Extraction failed for ${crawlResult.url}: could not recover JSON`)
        return []
      }
    }

    return parsed.map((s) => {
      const scheme = s as Record<string, unknown>
      return {
        ...scheme,
        // Hard sanitize official_link — LLMs sometimes ignore the prompt instruction.
        // Supplementary sites (consuladodelsalvador.com, simple.sv, etc.) are ONLY
        // used as knowledge sources. Users must never be sent to them.
        official_link: sanitizeOfficialLink(
          scheme.official_link as string | undefined,
          scheme.agency as string | undefined,
          crawlResult.isSupplementary,
          crawlResult.url
        ),
        is_supplementary: crawlResult.isSupplementary,
        raw_source_url: crawlResult.url,   // internal only — never shown to users
        extracted_at: new Date().toISOString(),
      }
    }) as ExtractedScheme[]
  } catch (err) {
    console.error(`Extraction failed for ${crawlResult.url}:`, err)
    return []
  }
}
