// Polyfill WebSocket for Node.js < 22 — must be first import
import ws from "ws"
;(globalThis as unknown as Record<string, unknown>).WebSocket ??= ws

import { crawlEntry, SEED_URLS } from "../lib/engine/crawler"
import { extractSchemes } from "../lib/engine/extractor"
import { verifyScheme } from "../lib/engine/verifier"
import { insertToReviewQueue, searchSchemes } from "../lib/engine/db"

async function main() {
  console.log("Starting ISSS test crawl...")

  const isssSeeds = SEED_URLS["SV"].filter(s => s.agency === "ISSS")
  console.log(`Found ${isssSeeds.length} ISSS seed URLs`)

  for (const seed of isssSeeds) {
    console.log(`\nCrawling: ${seed.url}`)
    const pages = await crawlEntry(seed)
    console.log(`Got ${pages.length} page(s)`)

    for (const page of pages) {
      console.log(`Extracting from: ${page.url}`)
      const schemes = await extractSchemes(page)
      console.log(`Extracted ${schemes.length} scheme(s)`)

      for (const scheme of schemes) {
        console.log(`  Verifying: ${scheme.scheme_name}`)
        const existing = await searchSchemes({ country: "SV", limit: 100 })
        const verification = await verifyScheme(
          scheme, existing, page.markdown, undefined, page.contentHash
        )
        await insertToReviewQueue(scheme, verification, "crawl", page.contentHash)
        console.log(`  → ${verification.overallStatus} | ${scheme.scheme_name}`)
        if (verification.flagReasons.length > 0) {
          console.log(`    Flags: ${verification.flagReasons.join(" | ")}`)
        }
      }
    }
  }

  console.log("\nDone. Check review_queue in Supabase.")
}

main().catch(console.error)
