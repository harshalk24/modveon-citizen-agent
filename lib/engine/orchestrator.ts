import { SEED_URLS, crawlEntry, groupSeedsByAgency } from "./crawler"
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
  const errors: string[] = []
  let pagesProcessed = 0
  let schemesFound = 0
  let schemesQueued = 0

  // Load existing schemes once for duplicate detection
  const existingSchemes = await searchSchemes({ country, limit: 500 })

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // ── Rate-limit strategy ───────────────────────────────────────────
  // Firecrawl free tier: 1 req/min globally.
  // Paid Starter tier: 200 req/min — set PAGE_DELAY_MS=200 and AGENCY_DELAY_MS=500.
  //
  // We group pages by agency so that:
  //   - Pages of the SAME agency are scraped back-to-back with a short delay (3s).
  //     This avoids wasting the 65s window on URLs we know are related.
  //   - A longer delay (65s on free tier) only fires between DIFFERENT agencies.
  //
  // With 12 agencies × ~3 pages each = ~36 total scrapes.
  // Free tier:  36 pages × 65s = ~39 min (unavoidable on free tier).
  // Paid tier:  36 pages × 0.5s = ~18s total.
  const PAGE_DELAY_MS   = parseInt(process.env.FIRECRAWL_PAGE_DELAY_MS   ?? "3000")   // between pages of same agency
  const AGENCY_DELAY_MS = parseInt(process.env.FIRECRAWL_AGENCY_DELAY_MS ?? "65000")  // between agencies

  const agencyGroups = groupSeedsByAgency(country)
  const agencies     = Array.from(agencyGroups.keys())

  console.log(`[Engine] Starting crawl for ${country}: ${agencies.length} agencies, ${SEED_URLS[country]?.length ?? 0} total pages`)
  console.log(`[Engine] Delays: ${PAGE_DELAY_MS}ms between pages, ${AGENCY_DELAY_MS}ms between agencies`)

  for (let agencyIdx = 0; agencyIdx < agencies.length; agencyIdx++) {
    const agencyName = agencies[agencyIdx]
    const agencySeeds = agencyGroups.get(agencyName)!

    // Sleep between agencies (not before the first one)
    if (agencyIdx > 0) {
      console.log(`[Engine] Waiting ${AGENCY_DELAY_MS / 1000}s before ${agencyName}...`)
      await sleep(AGENCY_DELAY_MS)
    }

    console.log(`[Engine] Agency ${agencyIdx + 1}/${agencies.length}: ${agencyName} (${agencySeeds.length} page${agencySeeds.length > 1 ? "s" : ""})`)

    for (let pageIdx = 0; pageIdx < agencySeeds.length; pageIdx++) {
      const seed = agencySeeds[pageIdx]

      // Short delay between pages of the same agency
      if (pageIdx > 0) {
        await sleep(PAGE_DELAY_MS)
      }

      try {
        console.log(`[Engine]   Scraping: ${seed.url}`)
        const pages = await crawlEntry(seed)
        pagesProcessed += pages.length

        for (const page of pages) {
          try {
            const schemes = await extractSchemes(page)
            schemesFound += schemes.length
            console.log(`[Engine]   → Extracted ${schemes.length} scheme(s) from ${page.url}`)

            for (const scheme of schemes) {
              try {
                // ── SKIP LOGIC ──────────────────────────────────────
                // 1. Already live in KB with same content hash → unchanged, skip
                // 2. Already pending in queue (not yet reviewed) → skip
                // 3. New scheme OR content changed → queue for review
                const { data: liveScheme } = await supabase
                  .from("schemes")
                  .select("id, content_hash")
                  .eq("agency", scheme.agency)
                  .eq("scheme_name", scheme.scheme_name)
                  .eq("country", scheme.country)
                  .single()

                if (liveScheme && liveScheme.content_hash === page.contentHash) {
                  console.log(`[Engine]   ⏭ Skipped (unchanged): ${scheme.scheme_name}`)
                  continue
                }

                // Check if already pending in queue (avoid duplicate review items)
                const { data: alreadyPending } = await supabase
                  .from("review_queue")
                  .select("id")
                  .eq("status", "pending")
                  .eq("content_hash", page.contentHash)
                  .limit(1)

                if (alreadyPending && alreadyPending.length > 0) {
                  console.log(`[Engine]   ⏭ Skipped (already in queue): ${scheme.scheme_name}`)
                  continue
                }

                const storedHash = liveScheme?.content_hash ?? undefined

                const verification = await verifyScheme(
                  scheme, existingSchemes, page.markdown, storedHash, page.contentHash
                )

                await insertToReviewQueue(scheme, verification, "crawl", page.contentHash)
                schemesQueued++
                console.log(`[Engine]   ✅ Queued: ${scheme.scheme_name} [${verification.overallStatus}]`)
              } catch (schemeErr) {
                errors.push(`Scheme error [${scheme.scheme_name}]: ${String(schemeErr)}`)
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
  }

  console.log(`[Engine] Crawl complete: ${pagesProcessed} pages, ${schemesFound} schemes found, ${schemesQueued} queued, ${errors.length} errors`)
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
