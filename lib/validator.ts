import { services, Service } from "@/lib/kb"

// Three states, not two — a binary alive/dead result is wrong for government
// sites, which commonly (a) reject HEAD outright and (b) block automated
// traffic with a WAF 403 regardless of whether the page is actually live.
// Both look identical to a naive checker but are NOT evidence of a dead page.
//   OK           — 2xx (redirects already resolved by fetch's redirect:"follow")
//   DEAD         — 404/410 (page confirmed gone), or a genuine DNS failure
//                  (the domain itself doesn't resolve). The ONLY alarm state.
//   INCONCLUSIVE — everything else: 403/405/429, any other non-2xx, timeouts,
//                  TLS errors. "Up but won't answer an automated check" — a
//                  human should glance at these, they are NOT reported as broken.
// Even GET + a browser User-Agent can't defeat a WAF that requires JS execution
// or a cookie handshake — fetch can't run JS. INCONCLUSIVE genuinely means
// "cannot determine automatically," not "probably dead."
export type LinkState = "OK" | "DEAD" | "INCONCLUSIVE"

export interface LinkCheckResult {
  serviceId: string
  // sourceUrl = internal/info reference. applyUrl = what the citizen actually
  // clicks to act (Rule 9's APPLY_NOW tag) — only set when the entry has steps;
  // absence is not a dead link (informational-only schemes have none).
  field: "sourceUrl" | "applyUrl"
  url: string
  state: LinkState
  status: number  // 0 for a network-level failure (no HTTP response at all)
  reason: string
}

export interface LinkCheckReport {
  dead: LinkCheckResult[]
  inconclusive: LinkCheckResult[]
  okCount: number
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

// Mirrors context-builder.ts's applyUrl derivation exactly — there is no
// separate `applyUrl` field on Service; it's sourceUrl reused when the entry
// has actionable steps. Kept as a named helper so both places can't drift.
function deriveApplyUrl(s: Service): string | null {
  return (s.steps && s.steps.length > 0) ? s.sourceUrl : null
}

function isDnsFailure(err: any): boolean {
  const code = err?.cause?.code ?? err?.code
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return true
  const message = String(err?.cause?.message ?? err?.message ?? "")
  return /ENOTFOUND|getaddrinfo/i.test(message)
}

function isTimeout(err: any): boolean {
  return err?.name === "TimeoutError" || err?.name === "AbortError"
}

async function classifyUrl(url: string): Promise<{ state: LinkState; status: number; reason: string }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(15000),
    })
    if (res.status >= 200 && res.status < 300) {
      return { state: "OK", status: res.status, reason: `${res.status} OK` }
    }
    if (res.status === 404 || res.status === 410) {
      return { state: "DEAD", status: res.status, reason: `${res.status} — page confirmed gone` }
    }
    return {
      state: "INCONCLUSIVE",
      status: res.status,
      reason: `${res.status} — site is reachable but blocked/rejected this automated request; not evidence the page is dead`,
    }
  } catch (err: any) {
    if (isDnsFailure(err)) {
      return { state: "DEAD", status: 0, reason: "DNS resolution failed — domain does not resolve" }
    }
    if (isTimeout(err)) {
      return { state: "INCONCLUSIVE", status: 0, reason: "request timed out — site may be slow or silently blocking automated requests" }
    }
    return {
      state: "INCONCLUSIVE",
      status: 0,
      reason: `network error (${err?.cause?.code ?? err?.name ?? "unknown"}) — cannot determine if the page is actually dead`,
    }
  }
}

// testServices defaults to the real KB — passing an override is only for
// unit tests (mocked responses) so this never fires live HTTP calls against
// the real ~30 entries during a test run.
export async function checkKBLinks(testServices: Service[] = services): Promise<LinkCheckReport> {
  console.log("Validator: checking", testServices.length, "KB links...")
  const dead: LinkCheckResult[] = []
  const inconclusive: LinkCheckResult[] = []
  let okCount = 0

  // Cache by URL — applyUrl equals sourceUrl whenever both are present, so
  // this avoids firing the same request twice per entry.
  const cache = new Map<string, { state: LinkState; status: number; reason: string }>()
  async function checkUrl(url: string) {
    if (!cache.has(url)) cache.set(url, await classifyUrl(url))
    return cache.get(url)!
  }

  async function record(serviceId: string, field: "sourceUrl" | "applyUrl", url: string) {
    const result = await checkUrl(url)
    if (result.state === "OK") { okCount++; return }
    const entry: LinkCheckResult = { serviceId, field, url, ...result }
    if (result.state === "DEAD") dead.push(entry)
    else inconclusive.push(entry)
  }

  for (const s of testServices) {
    await record(s.id, "sourceUrl", s.sourceUrl)
    const applyUrl = deriveApplyUrl(s)
    if (applyUrl) await record(s.id, "applyUrl", applyUrl)
  }

  console.log("Validator: link check complete —", dead.length, "dead,", inconclusive.length, "inconclusive,", okCount, "ok")
  return { dead, inconclusive, okCount }
}

export function validatePlanJSON(raw: string): { valid: boolean; parsed?: any; error?: string } {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(cleaned)
    if (!parsed.phases || !Array.isArray(parsed.phases)) {
      return { valid: false, error: "Missing phases array" }
    }
    for (const phase of parsed.phases) {
      if (!phase.steps || !Array.isArray(phase.steps)) {
        return { valid: false, error: `Phase ${phase.phase} missing steps array` }
      }
      for (const step of phase.steps) {
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
