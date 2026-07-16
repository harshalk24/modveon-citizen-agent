// NOTE FOR FUTURE: The LLM validation calls (validateContentMatch and
// validateChangeSignificance) are ideal candidates for replacement with a
// local SLM (Phi-4 Mini, Gemma 4 E4B, or a fine-tuned 3B model). These
// are classification tasks — a small model will be faster and cheaper
// once fine-tuned on your verified KB data. Swap by replacing the
// getLLM().complete() calls with your SLM client; the interface stays identical.

import { getLLM } from "@/lib/llm"
import type { ExtractedScheme } from "./extractor"

export type VerificationStatus = "pass" | "flag" | "fail"

export interface VerificationResult {
  checks: {
    linkAlive: boolean
    linkStatus: number
    requiresLogin: boolean
    finalUrl: string
    suggestedFallbackUrl?: string
    contentMatchesScheme: boolean | null
    contentMatchReason?: string
    isDuplicate: boolean
    duplicateOf?: string
    duplicateReason?: string
    hasRequiredFields: boolean
    missingFields: string[]
    changeIsSignificant: boolean | null
    changedFields?: string[]
  }
  overallStatus: VerificationStatus
  priority: "critical" | "high" | "normal" | "low"
  flagReasons: string[]
  verifiedAt: string
}

const REQUIRED_FIELDS = [
  "scheme_name",
  "agency",
  "country",
  "official_link",
  "description",
  "life_events",
]

const CONFIDENCE_THRESHOLD = 0.6

// ── AGENCY FALLBACK URLS ──────────────────────────────
// When a specific service URL is dead, fall back to the agency root.
// Used by the admin UI to suggest a replacement and by auto-repair logic.
export const AGENCY_ROOT_URLS: Record<string, string> = {
  ISSS:         "https://www.isss.gob.sv",
  RNPN:         "https://www.rnpn.gob.sv",
  INCAF:        "https://www.incaf.gob.sv",
  CONAMYPE:     "https://www.conamype.gob.sv",
  CNR:          "https://www.cnr.gob.sv",
  Hacienda:     "https://www.mh.gob.sv",
  MTPS:         "https://www.mtps.gob.sv",
  RREES:        "https://rree.gob.sv",
  Presidencia:  "https://www.presidencia.gob.sv",
  "Ciudad Mujer": "https://ciudadmujer.presidencia.gob.sv",
  FOSALUD:      "https://www.fosalud.gob.sv",
  BANDESAL:     "https://www.bandesal.gob.sv",
  ANDA:         "https://www.anda.gob.sv",
  Alcaldía:     "https://sansalvador.eregulations.org",
}

// ── CHECK 1: LINK ALIVE + LOGIN WALL DETECTION ────────
// El Salvador gov sites often redirect service pages to login.gob.sv
// when unauthenticated. fetch() follows redirects by default, so a
// login-wall page returns HTTP 200 — indistinguishable from a real page.
// We detect this by inspecting the final URL after redirect.
export async function checkLink(
  url: string
): Promise<{ alive: boolean; status: number; requiresLogin: boolean; finalUrl: string }> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    })

    const finalUrl = res.url ?? url
    // Detect silent redirect to the government SSO login portal
    const requiresLogin = finalUrl.includes("login.gob.sv") ||
                          finalUrl.includes("/login") && finalUrl.includes(".gob.sv")

    return { alive: res.ok, status: res.status, requiresLogin, finalUrl }
  } catch {
    return { alive: false, status: 0, requiresLogin: false, finalUrl: url }
  }
}

// ── CHECK 2: CONTENT STILL MATCHES SCHEME ────────────
// FUTURE SLM SWAP: replace gemini call with local model
async function validateContentMatch(
  schemeName: string,
  pageMarkdown: string
): Promise<{ matches: boolean; reason: string }> {
  const prompt = `Does this web page still contain information about the government service: "${schemeName}"?

Page content (first 1500 chars):
${pageMarkdown.slice(0, 1500)}

Return ONLY: {"matches": true or false, "reason": "one sentence"}`

  try {
    const text = await getLLM().complete(prompt, { temperature: 0.0, maxTokens: 100, json: true })
    return JSON.parse(text.trim()) as {
      matches: boolean
      reason: string
    }
  } catch {
    return { matches: true, reason: "Validation failed — assuming match" }
  }
}

// ── CHECK 3: DUPLICATE DETECTION ─────────────────────
function detectDuplicate(
  scheme: ExtractedScheme,
  existingSchemes: Record<string, unknown>[]
): { isDuplicate: boolean; duplicateOf?: string; reason?: string } {
  for (const existing of existingSchemes) {
    const sameAgency = existing.agency === scheme.agency
    const sameCountry = existing.country === scheme.country
    const existingEvents = (existing.life_events ?? existing.lifeEvents ?? []) as string[]
    const overlappingEvents = scheme.life_events?.some((e) =>
      existingEvents.includes(e)
    )

    if (sameAgency && sameCountry && overlappingEvents) {
      const existingName = String(existing.scheme_name ?? existing.name ?? "").toLowerCase()
      const newName = scheme.scheme_name?.toLowerCase() ?? ""
      const words = newName.split(" ")
      const hasNameOverlap = words.some(
        (w) => w.length > 4 && existingName.includes(w)
      )

      if (hasNameOverlap) {
        return {
          isDuplicate: true,
          duplicateOf: String(existing.id ?? ""),
          reason: `Same agency (${scheme.agency}) + overlapping life events + similar name`,
        }
      }
    }
  }
  return { isDuplicate: false }
}

// ── CHECK 5: CHANGE SIGNIFICANCE ─────────────────────
// Only runs when content hash differs from stored version.
// FUTURE SLM SWAP: ideal task for a fine-tuned small model
async function validateChangeSignificance(
  oldScheme: Record<string, unknown>,
  newScheme: ExtractedScheme
): Promise<{ significant: boolean; changedFields: string[] }> {
  const MEANINGFUL_FIELDS = [
    "amount",
    "documents_required",
    "eligibility",
    "deadline_days",
    "steps",
    "official_link",
    "office_hours",
  ]

  const changedFields: string[] = []
  for (const field of MEANINGFUL_FIELDS) {
    const oldVal = JSON.stringify(oldScheme[field] ?? "")
    const newVal = JSON.stringify(
      newScheme[field as keyof ExtractedScheme] ?? ""
    )
    if (oldVal !== newVal) changedFields.push(field)
  }

  if (changedFields.length === 0) {
    return { significant: false, changedFields: [] }
  }

  const oldValues = changedFields.reduce<Record<string, unknown>>(
    (acc, f) => ({ ...acc, [f]: oldScheme[f] }),
    {}
  )
  const newValues = changedFields.reduce<Record<string, unknown>>(
    (acc, f) => ({ ...acc, [f]: newScheme[f as keyof ExtractedScheme] }),
    {}
  )

  const prompt = `A government scheme's data changed. Are these changes significant enough to update the knowledge base?

Changed fields: ${changedFields.join(", ")}
Old values: ${JSON.stringify(oldValues)}
New values: ${JSON.stringify(newValues)}

Return ONLY: {"significant": true or false}`

  try {
    const text = await getLLM().complete(prompt, { temperature: 0.0, maxTokens: 100, json: true })
    const parsed = JSON.parse(text.trim()) as {
      significant: boolean
    }
    return { significant: parsed.significant, changedFields }
  } catch {
    // Default to significant — better to over-flag than miss a real change
    return { significant: true, changedFields }
  }
}

// ── PRIORITY SCORING ──────────────────────────────────
function scorePriority(
  scheme: ExtractedScheme,
  flagReasons: string[]
): "critical" | "high" | "normal" | "low" {
  const hasDeadline = !!scheme.deadline_days
  const isHighTrafficEvent =
    scheme.life_events?.includes("new-baby") ||
    scheme.life_events?.includes("job-loss")
  const isDeadLink = flagReasons.some((r) => r.includes("Dead link"))

  if (isDeadLink && (hasDeadline || isHighTrafficEvent)) return "critical"
  if (isDeadLink || hasDeadline) return "high"
  if (flagReasons.length > 0) return "normal"
  return "low"
}

// ── MAIN VERIFY FUNCTION ─────────────────────────────
export async function verifyScheme(
  scheme: ExtractedScheme,
  existingSchemes: Record<string, unknown>[],
  pageMarkdown?: string,
  storedHash?: string,
  currentHash?: string
): Promise<VerificationResult> {
  const flagReasons: string[] = []

  // Check 1: Link alive + login-wall detection
  const linkCheck = await checkLink(scheme.official_link)
  const suggestedFallback = AGENCY_ROOT_URLS[scheme.agency]

  if (!linkCheck.alive) {
    const fallbackNote = suggestedFallback
      ? ` Suggested fallback: ${suggestedFallback}`
      : ""
    flagReasons.push(
      `Dead link: ${scheme.official_link} → HTTP ${linkCheck.status}.${fallbackNote}`
    )
  } else if (linkCheck.requiresLogin) {
    // Alive but gated — we can still serve the scheme, but the apply button
    // should point to the agency root, not the login portal.
    flagReasons.push(
      `Login wall detected: ${scheme.official_link} redirects to ${linkCheck.finalUrl}. ` +
      `official_link should be updated to the informational page or agency root.` +
      (suggestedFallback ? ` Suggested: ${suggestedFallback}` : "")
    )
  }

  // Check 2: Content matches scheme (only if link alive + not behind login wall + have content)
  let contentMatch: { matches: boolean; reason: string } | null = null
  if (linkCheck.alive && !linkCheck.requiresLogin && pageMarkdown) {
    contentMatch = await validateContentMatch(
      scheme.scheme_name,
      pageMarkdown
    )
    if (!contentMatch.matches) {
      flagReasons.push(`Content mismatch: ${contentMatch.reason}`)
    }
  }

  // Check 3: Duplicate detection
  const dupCheck = detectDuplicate(scheme, existingSchemes)
  if (dupCheck.isDuplicate) {
    flagReasons.push(
      `Possible duplicate of ${dupCheck.duplicateOf}: ${dupCheck.reason}`
    )
  }

  // Check 4: Required fields
  const missingFields = REQUIRED_FIELDS.filter(
    (f) => !scheme[f as keyof ExtractedScheme]
  )
  if (missingFields.length > 0) {
    flagReasons.push(`Missing fields: ${missingFields.join(", ")}`)
  }

  // Confidence check
  if ((scheme.confidence ?? 0) < CONFIDENCE_THRESHOLD) {
    flagReasons.push(`Low confidence: ${scheme.confidence?.toFixed(2)}`)
  }

  // Check 5: Change significance (only if hash changed)
  let changeResult: { significant: boolean; changedFields: string[] } | null =
    null
  if (storedHash && currentHash && storedHash !== currentHash) {
    const existing = existingSchemes.find(
      (e) =>
        e.agency === scheme.agency &&
        (e.scheme_name === scheme.scheme_name || e.name === scheme.scheme_name)
    ) as Record<string, unknown> | undefined
    if (existing) {
      changeResult = await validateChangeSignificance(existing, scheme)
      if (changeResult.significant) {
        flagReasons.push(
          `Significant change in: ${changeResult.changedFields.join(", ")}`
        )
      }
    }
  }

  const hasDeadLink   = flagReasons.some((r) => r.includes("Dead link"))
  const hasLoginWall  = flagReasons.some((r) => r.includes("Login wall"))
  const overallStatus: VerificationStatus =
    flagReasons.length === 0 ? "pass"
    : hasDeadLink             ? "fail"
    :                           "flag"   // login wall + other issues = flag (not fail)

  return {
    checks: {
      linkAlive:             linkCheck.alive,
      linkStatus:            linkCheck.status,
      requiresLogin:         linkCheck.requiresLogin,
      finalUrl:              linkCheck.finalUrl,
      suggestedFallbackUrl:  hasDeadLink || hasLoginWall ? suggestedFallback : undefined,
      contentMatchesScheme:  contentMatch?.matches ?? null,
      contentMatchReason:    contentMatch?.reason,
      isDuplicate:           dupCheck.isDuplicate,
      duplicateOf:           dupCheck.duplicateOf,
      duplicateReason:       dupCheck.reason,
      hasRequiredFields:     missingFields.length === 0,
      missingFields,
      changeIsSignificant:   changeResult?.significant ?? null,
      changedFields:         changeResult?.changedFields,
    },
    overallStatus,
    priority: scorePriority(scheme, flagReasons),
    flagReasons,
    verifiedAt: new Date().toISOString(),
  }
}

// ── WEEKLY KB HEALTH CHECK ────────────────────────────
export async function verifyAllKBLinks(
  schemes: Array<{ id: string; official_link: string }>
): Promise<{ schemeId: string; url: string; status: number }[]> {
  const dead: { schemeId: string; url: string; status: number }[] = []
  for (const scheme of schemes) {
    const check = await checkLink(scheme.official_link)
    if (!check.alive) {
      dead.push({
        schemeId: scheme.id,
        url: scheme.official_link,
        status: check.status,
      })
    }
  }
  return dead
}
