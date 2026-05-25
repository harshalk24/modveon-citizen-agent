import { FirecrawlAppV1 } from "@mendable/firecrawl-js"
import crypto from "crypto"

const firecrawl = new FirecrawlAppV1({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})

// ── TYPES ─────────────────────────────────────────────
export interface SeedEntry {
  url: string
  agency: string
  crawl: boolean        // true = crawlUrl (paid tier only), false = scrapeUrl (1 credit)
  maxPages: number
  supplementary?: boolean
}

export interface CrawlResult {
  url: string
  markdown: string
  title?: string
  statusCode: number
  crawledAt: string
  agency: string
  isSupplementary: boolean
  contentHash: string
}

// ── SEED URLS ─────────────────────────────────────────
//
// Design principles:
//   1. Prefer specific service sub-pages over root homepages.
//      The extractor works from page content — a homepage gives you
//      navigation links; a service page gives you eligibility criteria,
//      required documents, deadlines and amounts.
//   2. crawl: false = scrapeUrl (1 credit per URL, exact page only).
//      crawl: true  = crawlUrl (1 credit per discovered sub-page, paid tier only).
//   3. Group entries by agency — the orchestrator sleeps between agencies,
//      not between pages within the same agency.
//   4. Mark non-official sources supplementary: true — extractor caps
//      their confidence at 0.7 so human review is always required.
//
// AGGREGATOR STRATEGY:
//   Sites like simple.sv and consuladodelsalvador.com are NOT agency sites —
//   they are SERVICE DIRECTORIES that link to many agencies at once.
//   On free tier: add their known sub-pages explicitly (crawl: false).
//   On paid tier: set crawl: true + maxPages: 40 and let Firecrawl
//   discover the full catalogue automatically.
//
// Rate limits:
//   Free tier:  1 req/min globally → 65s between agencies, 3s between pages.
//   Paid Starter (~$16/mo): 200 req/min → set env vars:
//     FIRECRAWL_PAGE_DELAY_MS=200 FIRECRAWL_AGENCY_DELAY_MS=500
//
export const SEED_URLS: Record<string, SeedEntry[]> = {
  SV: [

    // ── ISSS ─────────────────────────────────────────
    // Covers maternity, paternity, unemployment, dependent enrollment
    { url: "https://www.isss.gob.sv",                                                    agency: "ISSS", crawl: false, maxPages: 1 },
    { url: "https://www.isss.gob.sv/portal/index.php/servicios/prestaciones-economicas", agency: "ISSS", crawl: false, maxPages: 1 },
    { url: "https://www.isss.gob.sv/portal/index.php/servicios/prestaciones-medicas",    agency: "ISSS", crawl: false, maxPages: 1 },
    { url: "https://www.isss.gob.sv/portal/index.php/servicios/inscripcion",             agency: "ISSS", crawl: false, maxPages: 1 },

    // ── RNPN ─────────────────────────────────────────
    // Birth registration, DUI issuance, ID services
    { url: "https://www.rnpn.gob.sv",                           agency: "RNPN", crawl: false, maxPages: 1 },
    { url: "https://www.rnpn.gob.sv/tramites/",                 agency: "RNPN", crawl: false, maxPages: 1 },
    { url: "https://www.rnpn.gob.sv/tramites/registro-de-nacimiento/", agency: "RNPN", crawl: false, maxPages: 1 },

    // ── INSAFORP ──────────────────────────────────────
    // Free job training, retraining programs
    { url: "https://www.insaforp.org.sv",                       agency: "INSAFORP", crawl: false, maxPages: 1 },
    { url: "https://www.insaforp.org.sv/index.php/servicios",   agency: "INSAFORP", crawl: false, maxPages: 1 },
    { url: "https://www.insaforp.org.sv/index.php/cursos-y-capacitaciones", agency: "INSAFORP", crawl: false, maxPages: 1 },

    // ── CONAMYPE ──────────────────────────────────────
    // Small business grants, entrepreneurship programs
    { url: "https://www.conamype.gob.sv",                        agency: "CONAMYPE", crawl: false, maxPages: 1 },
    { url: "https://www.conamype.gob.sv/programas/",             agency: "CONAMYPE", crawl: false, maxPages: 1 },
    { url: "https://www.conamype.gob.sv/servicios/",             agency: "CONAMYPE", crawl: false, maxPages: 1 },

    // ── CNR ───────────────────────────────────────────
    // Business & property registration
    { url: "https://www.cnr.gob.sv",                             agency: "CNR", crawl: false, maxPages: 1 },
    { url: "https://www.cnr.gob.sv/tramites/",                   agency: "CNR", crawl: false, maxPages: 1 },

    // ── MINISTERIO DE HACIENDA ────────────────────────
    // NIT registration, tax compliance for new businesses
    { url: "https://www.mh.gob.sv",                              agency: "Hacienda", crawl: false, maxPages: 1 },
    { url: "https://www.mh.gob.sv/mh_seguimiento/faces/inicio.xhtml", agency: "Hacienda", crawl: false, maxPages: 1 },

    // ── MINISTERIO DE TRABAJO ─────────────────────────
    // Labor rights, severance, dismissal procedures, work permits.
    // Critically missing from KB: liquidación (severance), desempleo rights,
    // and the free mediation service (conciliación laboral).
    { url: "https://www.mtps.gob.sv",                                      agency: "MTPS", crawl: false, maxPages: 1 },
    { url: "https://www.mtps.gob.sv/servicios/",                           agency: "MTPS", crawl: false, maxPages: 1 },
    { url: "https://www.mtps.gob.sv/temas/derechos-laborales/",            agency: "MTPS", crawl: false, maxPages: 1 },
    { url: "https://www.mtps.gob.sv/servicios/conciliacion-laboral/",      agency: "MTPS", crawl: false, maxPages: 1 },
    { url: "https://www.mtps.gob.sv/temas/prestaciones-laborales/",        agency: "MTPS", crawl: false, maxPages: 1 },

    // ── PRESIDENCIA / CIUDAD MUJER ────────────────────
    // Maternal health subsidy, women's welfare programs
    { url: "https://www.presidencia.gob.sv",                     agency: "Presidencia", crawl: false, maxPages: 1 },
    { url: "https://ciudadmujer.presidencia.gob.sv/",            agency: "Ciudad Mujer", crawl: false, maxPages: 1 },

    // ── FOSALUD ───────────────────────────────────────
    // Basic healthcare for uninsured, community health posts
    { url: "https://www.fosalud.gob.sv",                         agency: "FOSALUD", crawl: false, maxPages: 1 },
    { url: "https://www.fosalud.gob.sv/servicios/",              agency: "FOSALUD", crawl: false, maxPages: 1 },

    // ── BANDESAL ──────────────────────────────────────
    // Development loans, SME credit lines
    { url: "https://www.bandesal.gob.sv",                        agency: "BANDESAL", crawl: false, maxPages: 1 },
    { url: "https://www.bandesal.gob.sv/productos/",             agency: "BANDESAL", crawl: false, maxPages: 1 },

    // ── ANDA ──────────────────────────────────────────
    // Water service subsidies, connection assistance
    { url: "https://www.anda.gob.sv",                            agency: "ANDA", crawl: false, maxPages: 1 },
    { url: "https://www.anda.gob.sv/tramites/",                  agency: "ANDA", crawl: false, maxPages: 1 },

    // ── RREES (Consulado) ─────────────────────────────
    // Power of attorney, consular services, diaspora
    { url: "https://rree.gob.sv",                                agency: "RREES", crawl: false, maxPages: 1 },
    { url: "https://rree.gob.sv/servicios-consulares/",          agency: "RREES", crawl: false, maxPages: 1 },

    // ── eREGULATIONS ──────────────────────────────────
    // Step-by-step official guides for starting a business
    { url: "https://sansalvador.eregulations.org",               agency: "eRegulations", crawl: false, maxPages: 1 },

    // ── SUPPLEMENTARY AGGREGATORS ─────────────────────
    // simple.sv is a civic service directory for El Salvador — its entire
    // value is in the subpages, not the homepage. Crawling to 40 pages
    // gives us a near-complete map of all Salvadoran government services.
    // On Firecrawl free tier: set crawl:false + manually add specific pages below.
    // On paid tier: set crawl:true to discover the full catalogue automatically.
    { url: "https://simple.sv",                                  agency: "Simple SV",    crawl: false, maxPages: 40, supplementary: true },
    { url: "https://simple.sv/tramites/",                        agency: "Simple SV",    crawl: false, maxPages: 1,  supplementary: true },
    { url: "https://simple.sv/beneficios/",                      agency: "Simple SV",    crawl: false, maxPages: 1,  supplementary: true },
    { url: "https://simple.sv/emprendimiento/",                  agency: "Simple SV",    crawl: false, maxPages: 1,  supplementary: true },

    // consuladodelsalvador.com aggregates diaspora procedures —
    // poder notarial chains, consulate appointments, residency.
    // Same approach: subpages contain the real content.
    { url: "https://consuladodelsalvador.com",                   agency: "Diaspora Info", crawl: false, maxPages: 15, supplementary: true },
    { url: "https://consuladodelsalvador.com/tramites/",         agency: "Diaspora Info", crawl: false, maxPages: 1,  supplementary: true },
    { url: "https://consuladodelsalvador.com/poder-notarial/",   agency: "Diaspora Info", crawl: false, maxPages: 1,  supplementary: true },
  ],
}

// ── CONTENT HASHING ───────────────────────────────────
export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex")
}

// ── SCRAPE A SINGLE PAGE (1 Firecrawl credit) ─────────
export async function scrapePage(entry: SeedEntry): Promise<CrawlResult | null> {
  try {
    const result = await firecrawl.scrapeUrl(entry.url, {
      formats: ["markdown"],
      onlyMainContent: true,
    })

    if (!result.success || !result.markdown) {
      console.warn(`[Crawler] Scrape returned no content: ${entry.url}`)
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
    console.error(`[Crawler] Scrape failed: ${entry.url}`, err)
    return null
  }
}

// ── CRAWL A SITE (1 credit per sub-page discovered) ───
// Requires Firecrawl paid plan (Starter+). Free tier will error.
export async function crawlSite(entry: SeedEntry): Promise<CrawlResult[]> {
  try {
    const result = await firecrawl.crawlUrl(entry.url, {
      limit: entry.maxPages,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
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
    console.error(`[Crawler] Crawl failed: ${entry.url}`, err)
    return []
  }
}

// ── SMART CRAWL ENTRY ────────────────────────────────
export async function crawlEntry(entry: SeedEntry): Promise<CrawlResult[]> {
  const root = await scrapePage(entry)
  if (!root) return []
  if (!entry.crawl) return [root]

  const adjusted: SeedEntry = { ...entry, maxPages: Math.max(entry.maxPages - 1, 1) }
  const subPages = await crawlSite(adjusted)

  const seen = new Set([root.url])
  const unique: CrawlResult[] = [root]
  for (const page of subPages) {
    if (!seen.has(page.url)) { seen.add(page.url); unique.push(page) }
  }
  return unique
}

// ── AGENCY GROUPING HELPER ────────────────────────────
// Returns the seed list grouped by agency name so the orchestrator
// can batch same-agency pages together (short delay between pages,
// longer delay between agencies to respect rate limits).
export function groupSeedsByAgency(country: string): Map<string, SeedEntry[]> {
  const seeds = SEED_URLS[country] ?? []
  const map = new Map<string, SeedEntry[]>()
  for (const seed of seeds) {
    const list = map.get(seed.agency) ?? []
    list.push(seed)
    map.set(seed.agency, list)
  }
  return map
}
