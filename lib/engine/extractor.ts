import { GoogleGenerativeAI } from "@google/generative-ai"
import type { CrawlResult } from "./crawler"

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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
  const model = gemini.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      temperature: 0.1,
    },
  })

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
  "new-baby", "job-loss", "start-business", "diaspora", "housing", "healthcare", "any"
- employment_types: only use values from this list:
  "employed", "self-employed", "unemployed", "informal", "any"
- confidence: 0.0–1.0. Be conservative — only give 0.9+ if the page is clearly about this scheme
- If supplementary/non-official source, set confidence no higher than 0.7
- official_link: MUST be an official government URL (.gob.sv or official agency domain).
  If this page is a supplementary/non-official source (e.g. consuladodelsalvador.com, simple.sv),
  find the .gob.sv link mentioned in the page content — never use the supplementary site's own URL.
  If no .gob.sv URL appears in the content, use the most relevant agency root (e.g. "https://www.isss.gob.sv").
  Never set official_link to a login portal URL (login.gob.sv) — use the pre-login service page instead.

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
    const result = await model.generateContent(prompt)
    const text = result.response.text()
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

    return parsed.map((s) => ({
      ...(s as Record<string, unknown>),
      is_supplementary: crawlResult.isSupplementary,
      raw_source_url: crawlResult.url,
      extracted_at: new Date().toISOString(),
    })) as ExtractedScheme[]
  } catch (err) {
    console.error(`Extraction failed for ${crawlResult.url}:`, err)
    return []
  }
}
