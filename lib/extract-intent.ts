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

export function extractEmployment(message: string): string | null {
  const lower = message.toLowerCase()
  if (/\b(employed|formal job|work for|trabajando|trabajo formal|contrato)\b/.test(lower)) return "employed"
  if (/\b(unemployed|no job|out of work|desempleado|sin empleo|sin trabajo)\b/.test(lower)) return "unemployed"
  if (/\b(self.employed|freelance|informal|independiente|cuenta propia|negocio propio)\b/.test(lower)) return "informal"
  return null
}
