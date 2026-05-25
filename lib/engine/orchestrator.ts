import { SEED_URLS, crawlEntry } from "./crawler"
import { extractSchemes } from "./extractor"
import { verifyScheme, verifyAllKBLinks } from "./verifier"
import { insertToReviewQueue, searchSchemes, supabase } from "./db"

// ── FULL CRAWL ────────────────────────────────────────
// Runs through all seed URLs for a country, extracts schemes,
// verifies each one, and inserts into the review queue.
// Designed to run as a background job (not in a serverless request).

export async function runFullCrawl(country: string = "SV"): Promise<{
  pagesProcessed: number
  schemesFound: number
  schemesQueued: number
  errors: string[]
}> {
  const seeds = SEED_URLS[country] ?? []
  const errors: string[] = []
  let pagesProcessed = 0
  let schemesFound = 0
  let schemesQueued = 0

  // Load existing schemes once for duplicate detection
  const existingSchemes = await searchSchemes({ country, limit: 500 })

  // Firecrawl free tier: 1 request/min global rate limit.
  // Each agency = 1 scrapeUrl call. Space them 65s apart.
  // To enable subpage crawling, upgrade Firecrawl and set crawl: true in SEED_URLS.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]
    // Wait between agencies to stay within free-tier rate limits
    if (i > 0) {
      console.log(`[Engine] Waiting 65s before next agency (rate limit)...`)
      await sleep(65_000)
    }
    try {
      console.log(`[Engine] Crawling ${seed.agency} (${i + 1}/${seeds.length})...`)
      const pages = await crawlEntry(seed)
      pagesProcessed += pages.length

      for (const page of pages) {
        try {
          const schemes = await extractSchemes(page)
          schemesFound += schemes.length

          for (const scheme of schemes) {
            try {
              // Look up stored hash for this scheme
              const { data: stored } = await supabase
                .from("schemes")
                .select("content_hash")
                .eq("agency", scheme.agency)
                .eq("scheme_name", scheme.scheme_name)
                .eq("country", scheme.country)
                .single()

              const storedHash = stored?.content_hash ?? undefined

              const verification = await verifyScheme(
                scheme,
                existingSchemes,
                page.markdown,
                storedHash,
                page.contentHash
              )

              await insertToReviewQueue(
                scheme,
                verification,
                "crawl",
                page.contentHash
              )
              schemesQueued++
            } catch (schemeErr) {
              errors.push(
                `Scheme error [${scheme.scheme_name}]: ${String(schemeErr)}`
              )
            }
          }
        } catch (extractErr) {
          errors.push(`Extract error [${page.url}]: ${String(extractErr)}`)
        }
      }
    } catch (crawlErr) {
      errors.push(`Crawl error [${seed.url}]: ${String(crawlErr)}`)
    }
  }

  return { pagesProcessed, schemesFound, schemesQueued, errors }
}

// ── WEEKLY KB HEALTH CHECK ────────────────────────────
// Checks all live scheme links and flags dead ones.
// Run as a weekly Vercel cron job.

export async function runWeeklyVerification(country: string = "SV"): Promise<{
  checked: number
  dead: number
  deadSchemes: { schemeId: string; url: string; status: number }[]
}> {
  const { data: schemes, error } = await supabase
    .from("schemes")
    .select("id, official_link")
    .eq("country", country)
    .eq("is_active", true)

  if (error || !schemes) {
    console.error("Weekly verification: could not load schemes", error)
    return { checked: 0, dead: 0, deadSchemes: [] }
  }

  const deadSchemes = await verifyAllKBLinks(
    schemes.map((s) => ({ id: s.id, official_link: s.official_link }))
  )

  // Mark dead schemes as needing review
  for (const dead of deadSchemes) {
    await supabase
      .from("schemes")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", dead.schemeId)

    await supabase.from("change_log").insert({
      scheme_id: dead.schemeId,
      change_type: "dead_link",
      changed_by: "weekly-verifier",
      changed_at: new Date().toISOString(),
    })
  }

  return {
    checked: schemes.length,
    dead: deadSchemes.length,
    deadSchemes,
  }
}
