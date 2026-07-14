import { situationLabel } from "@/lib/situation-labels"

// Cheap keyword fallback — the server flow (app/api/chat/route.ts) now uses
// classifyQuery's lifeEvent/employment facets as the source of truth. This is
// kept for the client-side localStorage cache (app/chat/page.tsx), which has
// no server round-trip to call the classifier with.
export function extractLifeEvent(message: string): string | null {
  const patterns: Record<string, string[]> = {
    "new-baby": [
      "baby", "born", "birth", "pregnant", "maternity", "newborn",
      "bebé", "bebe", "nacimiento", "embarazada", "tuve un bebé",
      "acabo de tener", "just had a baby", "had a baby", "having a baby",
      "expecting", "gave birth", "due soon",
    ],
    "job-loss": [
      "lost my job", "fired", "laid off", "unemployed", "lost job",
      "desempleo", "despido", "me quedé sin trabajo", "me despidieron",
      "sin trabajo", "quedé desempleado", "perdí mi trabajo",
    ],
    "start-business": [
      "register", "business", "negocio", "empresa",
      "registrar", "formalizar", "my business", "mi negocio",
      "start a business", "open a business", "abrir negocio",
      "emprender", "registro de empresa",
      "small business", "food business", "negocio de comida",
      "tienda", "store", "want to register", "quiero registrar",
      "santa ana business", "open a business", "abrir un negocio",
      "food stall", "puesto de comida", "my shop", "mi tienda",
    ],
    "diaspora": [
      "poder", "power of attorney", "sell house", "sell property",
      "vender casa", "vender propiedad", "parents in el salvador",
      "papás en el salvador", "living in the us", "viviendo en eeuu",
      "from the us", "desde eeuu", "desde estados unidos",
      "i need a poder", "necesito un poder", "poder notarial",
      "from abroad", "desde el extranjero",
    ],
  }
  const lower = message.toLowerCase()
  for (const [event, keywords] of Object.entries(patterns)) {
    if (keywords.some(k => lower.includes(k))) return event
  }
  return null
}

// Detects an explicit yes/no reply to a pending confirmation prompt.
// Keyword-based, same approach as extractLifeEvent — not a later-task concern.
export function extractConfirmation(message: string): "yes" | "no" | null {
  const lower = message.toLowerCase().trim()

  const matches = (phrases: string[]) =>
    phrases.some(p => (p.includes(" ") ? lower.includes(p) : new RegExp(`\\b${p}\\b`).test(lower)))

  const noPhrases = [
    "no", "nope", "not yet", "don't", "do not", "cancel", "nevermind", "never mind",
    "todavía no", "todavia no", "no todavía", "no todavia", "cancelar",
  ]
  if (matches(noPhrases)) return "no"

  const yesPhrases = [
    "yes", "yeah", "yep", "yup", "sure", "confirm", "confirmed", "correct",
    "that's right", "thats right", "go ahead", "start new plan", "start a new plan", "please do",
    "sí", "si", "confirmo", "correcto", "dale", "está bien", "esta bien", "empezá", "empeza",
  ]
  if (matches(yesPhrases)) return "yes"

  return null
}

// Deterministic safety net for the situation-ADD decision (app/api/chat/route.ts,
// Phase 2a — see lib/situations.ts). classifyQuery's LLM-based hypothetical carve-out
// is reliable against a message in isolation, but has been observed to occasionally
// misfire once ANY prior conversation history is present — e.g. "What if I lost my
// job?" can come back as a real "job-loss" declaration once earlier turns exist, even
// though the identical message with no history correctly returns null. Since a wrongly
// added situation is a durable write that's awkward to undo, this backstops the
// classifier with the same keyword-matching reliability tier the codebase already
// trusts for extractConfirmation's destructive-write gate — never used for `type` or
// other facets, only to veto an add when the raw text is plainly a hypothetical.
export function looksHypothetical(message: string): boolean {
  const lower = message.toLowerCase().trim()
  const matches = (phrases: string[]) =>
    phrases.some(p => (p.includes(" ") ? lower.includes(p) : new RegExp(`\\b${p}\\b`).test(lower)))
  return matches([
    "what if", "what would happen if", "if i", "can i", "could i", "should i",
    "would i", "am i allowed", "is it possible",
    "qué pasa si", "que pasa si", "qué pasaría si", "que pasaria si",
    "si yo", "puedo", "podría", "podria", "debería", "deberia",
  ])
}

// Deterministic safety-valve parser for the situation-REMOVE command (Phase 2a
// Step 6 — see lib/situations.ts's removeSituation). Doc explicitly scopes this
// as a "functional-only, rough affordance", not polished NLU: only fires on an
// explicit removal verb ("remove", "quitar", "eliminar", "ya no tengo"/"I no
// longer have") combined with wording that names one of the citizen's actually-
// active situations. Never infers removal from an unrelated statement (e.g. "I
// found a job" does NOT remove job-loss — that would require judgment this
// function deliberately doesn't attempt).
export function extractRemoveSituation(message: string, activeSituations: string[]): string | null {
  const lower = message.toLowerCase().trim()
  const removalTriggers = [
    "remove", "no longer", "not dealing with", "stop tracking", "delete",
    "quitar", "eliminar", "ya no tengo", "ya no estoy", "borrar", "quita",
  ]
  if (!removalTriggers.some(t => lower.includes(t))) return null

  for (const slug of activeSituations) {
    const variants = [slug.replace(/-/g, " "), situationLabel(slug, "en"), situationLabel(slug, "es")]
    if (variants.some(v => lower.includes(v.toLowerCase()))) return slug
  }
  return null
}

export function extractEmployment(message: string): string | null {
  const lower = message.toLowerCase()
  if (/\b(employed|formal job|work for|trabajando|trabajo formal|contrato)\b/.test(lower)) return "formal"
  if (/\b(unemployed|no job|out of work|desempleado|sin empleo|sin trabajo)\b/.test(lower)) return "unemployed"
  if (/\b(self.employed|freelance|informal|independiente|cuenta propia|negocio propio)\b/.test(lower)) return "informal"
  return null
}
