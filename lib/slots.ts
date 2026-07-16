import {
  extractBirthRegistered, extractAlreadyRegistered, extractHasEmployees,
  extractBusinessSizeTier, extractPoderPurpose, extractWasFormallyEmployed, SlotExtractor,
} from "@/lib/slot-extract"

// A slot exists only if not knowing it changes the answer (Task S1 rule 1).
// `critical` = any answer without it risks being wrong → ask BEFORE giving
// guidance on that point. Refining = the general answer is already correct/
// safe; the slot only personalizes it → answer first, then offer to refine.
export interface SlotDef {
  key: string
  critical: boolean
  ask: { en: string; es: string }
  extract: SlotExtractor
  // Derives this slot's value from OTHER already-known slots, so it's never
  // asked when it's already inferable (rule 2) — e.g. businessSizeTier already
  // tells us hasEmployees except in the ambiguous "storefront" case.
  inferFrom?: (slots: Record<string, string>) => string | null
  // Extra, slot-specific reinforcement for CRITICAL slots that don't have a
  // dedicated mode-block override (unlike diaspora-navigation) — names the
  // SPECIFIC claim to hold off on, since a generic "ask before asserting"
  // instruction alone wasn't concrete enough to stop the model from listing
  // tier-dependent details (e.g. Matrícula cost/requirement) alongside the ask.
  note?: { en: string; es: string }
}

export const SLOT_DEFS: Record<string, SlotDef[]> = {
  "new-baby": [
    {
      key: "birthRegistered",
      critical: false,
      ask: {
        en: "Have you already registered the birth with RNPN, or is that still on your list?",
        es: "¿Ya registraste el nacimiento en el RNPN, o todavía lo tenés pendiente?",
      },
      extract: extractBirthRegistered,
    },
  ],
  "job-loss": [
    {
      // Task 2b eligibility FILTER: the "was formerly formal" fact the
      // prior_formal_ok gate reads (lib/kb.ts's isEligible). NOT critical —
      // the unemployment/maternity benefits already surface while this is
      // unknown (surface-unless-known-negative); this slot only refines
      // toward the one correct suppression (a confirmed "no").
      key: "wasFormallyEmployed",
      critical: false,
      ask: {
        en: "Were you formally employed (contributing to ISSS) before losing your job?",
        es: "¿Estabas empleado formalmente (cotizando al ISSS) antes de perder tu empleo?",
      },
      extract: extractWasFormallyEmployed,
    },
  ],
  "start-business": [
    {
      key: "businessSizeTier",
      critical: true,
      ask: {
        en: "Is it just you running it, or do you have a storefront or employees?",
        es: "¿Lo manejás solo/a vos, o tenés un local o empleados?",
      },
      extract: extractBusinessSizeTier,
      note: {
        en: "Specifically: do not state whether they need a Matrícula de Empresa (CNR business registration), and do not describe its cost or requirements, until you know this. You may still mention other services normally (e.g. CONAMYPE grants) — only the Matrícula guidance is gated.",
        es: "Específicamente: no digas si necesita una Matrícula de Empresa (registro CNR), ni describas su costo o requisitos, hasta saber esto. Podés mencionar otros servicios con normalidad (ej. fondos de CONAMYPE) — solo la guía de Matrícula está condicionada.",
      },
    },
    {
      key: "alreadyRegistered",
      critical: false,
      ask: {
        en: "Have you already registered your business, or are you just getting started?",
        es: "¿Ya registraste tu negocio, o estás recién empezando?",
      },
      extract: extractAlreadyRegistered,
    },
    {
      key: "hasEmployees",
      critical: false,
      ask: {
        en: "Do you have any employees, or is it just you?",
        es: "¿Tenés empleados, o sos solo vos?",
      },
      extract: extractHasEmployees,
      inferFrom: (slots) => {
        if (slots.businessSizeTier === "employees") return "yes"
        if (slots.businessSizeTier === "solo") return "no"
        return null // "storefront" is genuinely ambiguous — ask directly
      },
    },
  ],
  diaspora: [
    {
      key: "poderPurpose",
      critical: true,
      ask: {
        en: "What do you need the poder for — selling or managing property, or something going through the courts?",
        es: "¿Para qué necesitás el poder — vender o administrar una propiedad, o algo que pasa por un tribunal?",
      },
      extract: extractPoderPurpose,
    },
  ],
}

// Applies every slot's inferFrom, folding freshly-derivable values into the
// known set — so e.g. a citizen who just answered businessSizeTier=solo never
// gets separately asked hasEmployees on the same or a later turn.
export function applySlotInferences(lifeEvent: string, slots: Record<string, string>): Record<string, string> {
  const defs = SLOT_DEFS[lifeEvent] || []
  const result = { ...slots }
  for (const def of defs) {
    if (result[def.key] !== undefined) continue
    const inferred = def.inferFrom?.(result)
    if (inferred !== null && inferred !== undefined) result[def.key] = inferred
  }
  return result
}

// The single most-decisive missing slot for this turn (rule 3: one question
// at a time — never batch). Critical-missing slots always win; only once
// every critical slot is known do we look at refining slots. Returns null
// when nothing is missing — the system prompt then gets no slot instruction
// at all, so there's nothing to nudge a spurious question (test #6).
export function nextMissingSlot(lifeEvent: string, slots: Record<string, string>): SlotDef | null {
  const defs = SLOT_DEFS[lifeEvent] || []
  const missing = defs.filter(d => slots[d.key] === undefined)
  if (missing.length === 0) return null
  const critical = missing.find(d => d.critical)
  return critical || missing[0]
}
