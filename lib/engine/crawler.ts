import { FirecrawlAppV1 } from "@mendable/firecrawl-js"
import crypto from "crypto"

// FirecrawlAppV1 is the v1-compatible API that has scrapeUrl/crawlUrl.
// The default export in firecrawl-js v4 is a different client with a
// different interface — FirecrawlAppV1 is the drop-in for our use case.
const firecrawl = new FirecrawlAppV1({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})

// ── TYPES ─────────────────────────────────────────────
export interface SeedEntry {
  url: string
  agency: string
  crawl: boolean        // true = crawlUrl(), false = scrapeUrl()
  maxPages: number      // cap to control credit usage
  supplementary?: boolean // true = not an official .gob.sv source
}

export interface CrawlResult {
  url: string
  markdown: string
  title?: string
  statusCode: number
  crawledAt: string
  agency: string
  isSupplementary: boolean
  contentHash: string   // SHA-256 of markdown content
}

// ── SEED URLs ─────────────────────────────────────────
// One root URL per agency. Firecrawl discovers sub-pages.
// Add new agencies here — no other file needs changing.
// crawl: false = scrape root page only (1 credit).
// crawl: true  = also crawl subpages (many credits, requires paid Firecrawl plan).
// Free tier allows only 1 request/min globally — keep crawl: false until upgraded.
export const SEED_URLS: Record<string, SeedEntry[]> = {
  SV: [
    { url: "https://www.isss.gob.sv", agency: "ISSS", crawl: false, maxPages: 1 },
    { url: "https://www.rnpn.gob.sv", agency: "RNPN", crawl: false, maxPages: 1 },
    { url: "https://www.conamype.gob.sv", agency: "CONAMYPE", crawl: false, maxPages: 1 },
    { url: "https://www.cnr.gob.sv", agency: "CNR", crawl: false, maxPages: 1 },
    { url: "https://www.mh.gob.sv", agency: "Hacienda", crawl: false, maxPages: 1 },
    { url: "https://www.insaforp.org.sv", agency: "INSAFORP", crawl: false, maxPages: 1 },
    { url: "https://rree.gob.sv", agency: "RREES", crawl: false, maxPages: 1 },
    { url: "https://sansalvador.eregulations.org", agency: "eRegulations", crawl: false, maxPages: 1 },
    { url: "https://simple.sv", agency: "Simple SV", crawl: false, maxPages: 1 },
    { url: "https://consuladodelsalvador.com", agency: "Diaspora Info", crawl: false, maxPages: 1, supplementary: true },
  ],
}

// ── CONTENT HASHING ───────────────────────────────────
export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex")
}

// ── SCRAPE A SINGLE PAGE (1 credit) ──────────────────
export async function scrapePage(
  entry: SeedEntry
): Promise<CrawlResult | null> {
  try {
    const result = await firecrawl.scrapeUrl(entry.url, {
      formats: ["markdown"],
      onlyMainContent: true,
    })

    if (!result.success || !result.markdown) {
      console.warn(`Scrape returned no content: ${entry.url}`)
      return null
    }

    return {
      url: entry.url,
      markdown: result.markdown,
      title: result.metadata?.title,
      statusCode: 200,
      crawledAt: new Date().toISOString(),
      agency: entry.agency,
      isSupplementary: entry.supplementary ?? false,
      contentHash: hashContent(result.markdown),
    }
  } catch (err) {
    console.error(`Scrape failed: ${entry.url}`, err)
    return null
  }
}

// ── CRAWL A SITE (1 credit per page found) ───────────
export async function crawlSite(
  entry: SeedEntry
): Promise<CrawlResult[]> {
  try {
    const result = await firecrawl.crawlUrl(entry.url, {
      limit: entry.maxPages,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    })

    if (!result.success || !result.data) return []

    return result.data
      .filter((p) => (p.markdown?.length ?? 0) > 200)
      .map((p) => {
        const md = p.markdown ?? ""
        return {
          url: p.metadata?.sourceURL ?? entry.url,
          markdown: md,
          title: p.metadata?.title,
          statusCode: 200,
          crawledAt: new Date().toISOString(),
          agency: entry.agency,
          isSupplementary: entry.supplementary ?? false,
          contentHash: hashContent(md),
        } satisfies CrawlResult
      })
  } catch (err) {
    console.error(`Crawl failed: ${entry.url}`, err)
    return []
  }
}

// ── CREDIT-EFFICIENT CRAWL DECISION ──────────────────
// Always scrape root first (1 credit).
// Only crawl sub-pages if crawl: true.
export async function crawlEntry(
  entry: SeedEntry
): Promise<CrawlResult[]> {
  const root = await scrapePage(entry)
  if (!root) return []

  if (!entry.crawl) return [root]

  // crawlSite with one fewer page since root already fetched
  const adjusted: SeedEntry = {
    ...entry,
    maxPages: Math.max(entry.maxPages - 1, 1),
  }
  const subPages = await crawlSite(adjusted)

  // Deduplicate by URL
  const seen = new Set([root.url])
  const unique: CrawlResult[] = [root]
  for (const page of subPages) {
    if (!seen.has(page.url)) {
      seen.add(page.url)
      unique.push(page)
    }
  }
  return unique
}
