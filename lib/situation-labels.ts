// Short noun-phrase labels for a situation slug — shared by server-side prompt
// building (lib/context-builder.ts) and client-side UI (the plan page's
// per-step situation tags). Kept in its own tiny, dependency-free module so
// client components never pull in context-builder.ts's transitive chain
// (classify-query.ts → lib/llm.ts → the OpenAI/Gemini SDKs) just for a label
// lookup. Covers the same slugs as the onboarding situation chips
// (app/chat/page.tsx's situationButtons) plus the few additional lifeEvent
// values used only inside the KB's own entries.
export const SITUATION_LABELS: Record<string, { en: string; es: string }> = {
  "new-baby":        { en: "new baby",                    es: "nuevo bebé" },
  "job-loss":        { en: "job loss",                    es: "pérdida de empleo" },
  "start-business":  { en: "starting a business",         es: "inicio de negocio" },
  "diaspora":        { en: "managing things from abroad", es: "trámites desde el exterior" },
  "marriage":        { en: "marriage",                    es: "matrimonio" },
  "death":           { en: "family loss",                 es: "pérdida familiar" },
  "retirement":      { en: "retirement",                  es: "jubilación" },
  "driving-license": { en: "driver's license",            es: "licencia de conducir" },
  "property":        { en: "property",                    es: "propiedad" },
  "education":       { en: "education/training",          es: "educación/capacitación" },
  "separation":      { en: "separation/divorce",          es: "separación/divorcio" },
  "housing":         { en: "housing",                     es: "vivienda" },
  "social-benefits": { en: "social benefits",             es: "beneficios sociales" },
}

export function situationLabel(slug: string, language: "en" | "es"): string {
  return SITUATION_LABELS[slug]?.[language] ?? slug
}
