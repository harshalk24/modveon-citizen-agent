// Query-scoped semantic retrieval, layered on top of the existing situational
// (lifeEvent-based) KB lookup — "augment," not replace. Fixes #6: a specific
// topical question (e.g. "what scholarships exist?") no longer gets answered
// with the citizen's unrelated situation entitlements just because that's all
// lookupServices() knows how to return.
//
// backdrop = the citizen's ongoing situation (unchanged lookupServices() call)
// foreground = KB entries semantically close to THIS turn's message, floor-
//              filtered so a genuine miss stays a miss instead of forcing a
//              top-K match. See KB_ENRICH's spike notes for how the floors
//              were calibrated (40 hand-labeled query/entry pairs).
import OpenAI from "openai"
import { services, lookupServices, Service } from "./kb"

export type ScoredService = Service & {
  _score?: number
  _source: "backdrop" | "foreground" | "both"
  // Which active situation(s) this entry's backdrop membership belongs to —
  // e.g. ["new-baby"] or ["new-baby","job-loss"] if it happens to qualify
  // under both. Undefined for foreground-only entries. Drives the grouped
  // "your situations" presentation in context-builder.ts (Phase 2a).
  _situations?: string[]
}
export type RetrievalResult = {
  services: ScoredService[]
  foregroundCount: number
  isHonestMiss: boolean
}

// CONFIG — floors are provisional (calibrated on 40 hand pairs). Read from
// env so they can be tuned without a code change. ES scores run ~0.1 higher
// than EN on this embedding model, hence the per-language floor.
const FLOOR = {
  en: Number(process.env.SEM_FLOOR_EN ?? 0.30),
  es: Number(process.env.SEM_FLOOR_ES ?? 0.44),
}
const TOP_K = 5
const EMBED_MODEL = "text-embedding-3-large"

// Which query types get a semantic foreground. meta = no foreground (nothing
// to look up); out-of-scope never reaches retrieval (short-circuited
// upstream in route.ts) but is excluded here too since gating is internal.
const FOREGROUND_TYPES = new Set([
  "depth-knowledge", "open-ended", "no-context-open", "service-lookup",
  "diaspora-navigation", "plan-clarification",
])

function embedText(e: Service): string {
  return [e.name, e.nameEs, e.description, e.descriptionEs, e.agency].filter(Boolean).join(" ")
}

let _client: OpenAI | null = null
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

async function embed(texts: string[]): Promise<number[][]> {
  const res = await client().embeddings.create({ model: EMBED_MODEL, input: texts })
  return res.data.map(d => d.embedding)
}

function normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return mag === 0 ? v : v.map(x => x / mag)
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

// Lazy, module-level cache — one batch embedding call per cold instance.
// Fine at 25 entries; a redeploy re-embeds. When the KB moves to a real
// store, this is the one place that swaps for a pgvector query.
let _kbVecs: number[][] | null = null
let _kbIds: string[] = []
async function ensureKBEmbedded() {
  if (_kbVecs) return
  const texts = services.map(embedText)
  const vecs = await embed(texts)
  _kbVecs = vecs.map(normalize)
  _kbIds = services.map(s => s.id)
}

async function nearest(queryVec: number[], k: number): Promise<Array<{ id: string; score: number }>> {
  await ensureKBEmbedded()
  const scores = _kbVecs!.map((v, i) => ({ id: _kbIds[i], score: dot(queryVec, v) }))
  return scores.sort((a, b) => b.score - a.score).slice(0, k)
}

export async function retrieveServices(p: {
  country: string
  // Phase 2a: a citizen can hold N concurrent situations. Pass
  // getActiveSituations(ctx) — a single-element array behaves exactly as
  // the old single-lifeEvent path (no regression).
  lifeEvents: string[]
  employment: string
  slots?: Record<string, string>
  query: string
  queryType: string
  lang: "en" | "es"
}): Promise<RetrievalResult> {
  // BACKDROP — union of each active situation's lookupServices, deduped and
  // tagged with which situation(s) it came from (for the grouped "your
  // situations" presentation — see context-builder.ts). Intentionally
  // uncapped: every active situation's real entries must fully surface,
  // never silently truncated by an arbitrary size limit (the multi-context
  // Colab check's "no dilution" requirement — a fixed cap sized for one
  // situation would drop entries once a citizen has two or more).
  const backdropMap = new Map<string, { service: Service; situations: string[] }>()
  for (const le of p.lifeEvents) {
    const entries = lookupServices({ country: p.country, lifeEvent: le, employment: p.employment, slots: p.slots })
    for (const s of entries) {
      const existing = backdropMap.get(s.id)
      if (existing) existing.situations.push(le)
      else backdropMap.set(s.id, { service: s, situations: [le] })
    }
  }

  // FOREGROUND — semantic matches for THIS query, floor-filtered, unrestricted
  // across the whole KB (not scoped to any active situation). Unchanged by
  // Phase 2a — already bounded to at most TOP_K regardless of how many
  // situations are active.
  let foreground: Array<{ id: string; score: number }> = []
  const runForeground = FOREGROUND_TYPES.has(p.queryType)
  if (runForeground && p.query.trim()) {
    const [qv] = (await embed([p.query])).map(normalize)
    const floor = FLOOR[p.lang] ?? FLOOR.en
    foreground = (await nearest(qv, TOP_K)).filter(r => r.score >= floor)
  }

  // MERGE — dedup by id; an id present in both keeps its foreground score
  // and is relabeled "both" (its _situations are still recorded). Foreground/
  // both (scored) rank above backdrop-only entries, which keep their
  // per-situation lookupServices priority order.
  const byId = new Map<string, ScoredService>()
  for (const f of foreground) {
    const s = services.find(x => x.id === f.id)
    if (!s) continue
    byId.set(f.id, { ...s, _score: f.score, _source: "foreground" })
  }
  for (const [id, { service, situations }] of backdropMap) {
    const existing = byId.get(id)
    if (existing) { existing._source = "both"; existing._situations = situations }
    else byId.set(id, { ...service, _source: "backdrop", _situations: situations })
  }
  const scored  = [...byId.values()].filter(s => s._source !== "backdrop")
    .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
  const trailing = [...byId.values()].filter(s => s._source === "backdrop")
  const merged = [...scored, ...trailing]

  return {
    services: merged,
    foregroundCount: foreground.length,
    isHonestMiss: runForeground && foreground.length === 0,
  }
}
