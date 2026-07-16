import { FirecrawlAppV1 } from "@mendable/firecrawl-js"
import crypto from "crypto"

// Lazy singleton — constructor is deferred until first crawl call so that
// Next.js can build the route modules without FIRECRAWL_API_KEY present.
let _firecrawl: FirecrawlAppV1 | null = null
function getFirecrawl(): FirecrawlAppV1 {
  if (!_firecrawl) {
    _firecrawl = new FirecrawlAppV1({ apiKey: process.env.FIRECRAWL_API_KEY! })
  }
  return _firecrawl
}

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
    { url: "https://www.isss.gob.sv",                                       agency: "ISSS", crawl: false, maxPages: 1 },
    { url: "https://www.isss.gob.sv/portal/index.php/servicios",           agency: "ISSS", crawl: false, maxPages: 1 },
    { url: "https://www.isss.gob.sv/portal/index.php/afiliados",           agency: "ISSS", crawl: false, maxPages: 1 },

    // ── RNPN ─────────────────────────────────────────
    // Birth registration, DUI issuance, ID services
    { url: "https://www.rnpn.gob.sv",                           agency: "RNPN", crawl: false, maxPages: 1 },
    { url: "https://www.rnpn.gob.sv/tramites/",                 agency: "RNPN", crawl: false, maxPages: 1 },
    { url: "https://www.rnpn.gob.sv/tramites/registro-de-nacimiento/", agency: "RNPN", crawl: false, maxPages: 1 },

    // ── INCAF (successor to INSAFORP, dissolved 2024) ──
    // Free job training, retraining programs
    { url: "https://www.incaf.gob.sv",                          agency: "INCAF", crawl: false, maxPages: 1 },
    { url: "https://www.incaf.gob.sv/guia-de-servicios/",       agency: "INCAF", crawl: false, maxPages: 1 },
    { url: "https://www.incaf.gob.sv/formacion-profesional/",   agency: "INCAF", crawl: false, maxPages: 1 },

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

    // ── SIMPLE.SV — CONFIRMED PUBLIC PROCEDURE PAGES ─────
    // These specific tramite pages are publicly readable (no login needed to
    // view cost, documents, steps). Login only required to INITIATE the tramite.
    // Each page has real structured data: cost, time, documents, steps.
    { url: "https://simple.sv/tramite/certificacion-de-partidas/ciudadano",                                                                    agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/constancia-de-antecedentes-policiales/nacionales",                                                       agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/solicitud-de-fijacion-cuota-alimenticia/solicitud-de-fijacion-cuota-alimenticia",                        agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/consulta-y-pago-de-prestamos-fsv/persona-natural",                                                       agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/otorgamiento-de-cita-medica/persona-natural",                                                            agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/apostillado-de-certificacion-de-licencia-de-conducir/persona-natural",                                   agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/tramite-de-reembolsos-por-gastos-medicos-hospitalarios/persona-natural",                                 agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/autentica-de-documentos-academicos/ciudadano",                                                           agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/constancias-de-pensionados/constancia-de-pensionados",                                                   agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/constancia-de-afiliacion-y-beneficio/persona-natural",                                                   agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/solicitud-de-solvencia-de-pension-alimenticia-de-la-pgr/persona-natural",                                agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/modalidades/2/emision-de-certificacion-de-antecedentes-penales",                                        agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/boleta-de-resultados-paes-avanzo/ciudadano",                                                             agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/solicitud-de-constancias-de-estudios/solicitud-de-constancias-de-estudios",                              agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },
    { url: "https://simple.sv/tramite/certificacion-de-registro-de-titulo-de-educacion-media/modalidad-unica",                                 agency: "Simple SV", crawl: false, maxPages: 1, supplementary: true },

    // ── CONSULADO — DIASPORA PROCEDURES ───────────────────
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
    const result = await getFirecrawl().scrapeUrl(entry.url, {
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
    const result = await getFirecrawl().crawlUrl(entry.url, {
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
