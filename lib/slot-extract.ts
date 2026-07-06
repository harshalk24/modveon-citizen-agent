// Deterministic keyword extraction for slot answers — same reliability tier
// as extract-intent.ts's extractConfirmation, which the server already trusts
// to commit a durable (destructive) pendingLifeEvent reset. A match is the
// gate: an ambiguous reply matches nothing and writes nothing, leaving the
// slot open rather than guessing. Scoped per-slot (via pendingSlot) so a bare
// "yes"/"no" is never ambiguous about which question it's answering.

export type SlotExtractor = (message: string) => string | null

const matches = (lower: string, phrases: string[]) =>
  phrases.some(p => (p.includes(" ") ? lower.includes(p) : new RegExp(`\\b${p}\\b`).test(lower)))

const YES_PHRASES = [
  "yes", "yeah", "yep", "yup", "sure", "already", "did that", "done",
  "sí", "si", "ya lo hice", "ya", "listo",
]
const NO_PHRASES = [
  "no", "nope", "not yet", "haven't", "have not", "still need to",
  "todavía no", "todavia no", "no todavía", "aún no", "aun no",
]

function extractYesNo(message: string): string | null {
  const lower = message.toLowerCase().trim()
  if (matches(lower, NO_PHRASES)) return "no"
  if (matches(lower, YES_PHRASES)) return "yes"
  return null
}

export const extractBirthRegistered: SlotExtractor = extractYesNo
export const extractAlreadyRegistered: SlotExtractor = extractYesNo
export const extractHasEmployees: SlotExtractor = extractYesNo

export const extractBusinessSizeTier: SlotExtractor = (message) => {
  const lower = message.toLowerCase()
  const employeesPhrases = [
    "employees", "workers", "staff", "people working for me", "hire",
    "empleados", "trabajadores", "personal", "gente que trabaja",
  ]
  const storefrontPhrases = [
    "storefront", "shop", "store", "location", "premises", "office",
    "local", "tienda", "negocio establecido", "punto de venta",
  ]
  const soloPhrases = [
    "just me", "only me", "by myself", "alone", "solo vendor", "small stall",
    "one person", "on my own", "no employees", "no staff",
    "solo yo", "yo sola", "yo solo", "sola", "solamente yo", "puesto pequeño", "sin empleados",
  ]
  // Check solo phrases FIRST — several of them ("no employees", "no staff")
  // contain the same words the employees-check looks for, just negated.
  if (matches(lower, soloPhrases)) return "solo"
  if (matches(lower, employeesPhrases)) return "employees"
  if (matches(lower, storefrontPhrases)) return "storefront"
  return null
}

export const extractPoderPurpose: SlotExtractor = (message) => {
  const lower = message.toLowerCase()
  const judicialPhrases = [
    "court", "lawsuit", "judicial", "legal case", "litigation", "custody", "divorce",
    "tribunal", "demanda", "caso legal", "juicio", "custodia", "divorcio",
  ]
  const propertyPhrases = [
    "property", "house", "land", "sell", "selling", "real estate", "manage my parents",
    "propiedad", "casa", "terreno", "vender", "bienes raíces", "administrar",
  ]
  if (matches(lower, judicialPhrases)) return "judicial"
  if (matches(lower, propertyPhrases)) return "property"
  const generalPhrases = ["general power", "poder general", "bank", "banco", "manage my affairs", "administrar mis asuntos"]
  if (matches(lower, generalPhrases)) return "general"
  return null
}
