export interface Service {
  id: string
  country: string
  lifeEvents: string[]
  employment: string[]
  name: string
  nameEs: string
  agency: string
  agencyFull: string
  description: string
  descriptionEs: string
  amount?: string
  deadline?: string
  deadlineDays?: number
  downloadUrl?: string
  priority: number
  weekToApply: number
  documents: string[]
  documentsEs: string[]
  sourceUrl: string
  lastVerified: string
  dependsOn?: string[]
  blocks?: string[]
  officeHours?: string
  capitalAddress?: string
  universalTip?: string
  siteNavigation?: string
}

export const services: Service[] = [
  // ── EL SALVADOR — NEW BABY ─────────────────────────────
  {
    id: "sv-rnpn-birth-registration",
    country: "SV", lifeEvents: ["new-baby"], employment: ["any"],
    name: "Birth registration at RNPN",
    nameEs: "Registro de nacimiento en el RNPN",
    agency: "RNPN", agencyFull: "Registro Nacional de las Personas Naturales",
    description: "Register your baby's birth within 30 days. A late fee applies if missed.",
    descriptionEs: "Registrá el nacimiento de tu bebé dentro de 30 días. Se cobra multa si se pasa el plazo.",
    deadline: "30 days after birth", deadlineDays: 30,
    priority: 1, weekToApply: 1,
    documents: ["Your DUI", "Hospital discharge certificate", "Father's DUI (if applicable)"],
    documentsEs: ["Tu DUI", "Constancia de alta del hospital", "DUI del padre (si aplica)"],
    sourceUrl: "https://www.rnpn.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–3:30pm",
    capitalAddress: "Centro Gubernamental, Alameda Juan Pablo II, San Salvador (for other cities, search 'RNPN [your city]')",
    universalTip: "Bring originals AND photocopies of every document — RNPN keeps the originals.",
    siteNavigation: "rnpn.gob.sv → Servicios → Inscripción de Nacimiento (as of May 2026)",
    blocks: ["sv-isss-dependent-enrollment", "sv-child-subsidy"]
  },
  {
    id: "sv-isss-maternity-benefit",
    country: "SV", lifeEvents: ["new-baby"], employment: ["employed"],
    name: "Maternity benefit",
    nameEs: "Prestación por maternidad",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "100% of your base salary for 12 weeks. Requires 36 weeks of contributions.",
    descriptionEs: "El 100% de tu salario base durante 12 semanas. Requiere 36 semanas cotizadas.",
    amount: "$400/mo (if your salary is $400/mo)",
    priority: 2, weekToApply: 1,
    documents: ["DUI", "Hospital discharge certificate", "ISSS referral form"],
    documentsEs: ["DUI", "Constancia del hospital", "Hoja de referencia del ISSS"],
    sourceUrl: "https://www.isss.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 7:30am–3:30pm",
    capitalAddress: "Edificio ISSS Central, 1a Calle Poniente, San Salvador (for other cities, search 'ISSS [your city]')",
    universalTip: "Tell the security guard 'vengo por prestación de maternidad' — they will direct you to the right window.",
    siteNavigation: "isss.gob.sv → Ciudadano → Prestaciones → Maternidad (as of May 2026)",
    downloadUrl: "https://www.isss.gob.sv/formularios/solicitud-prestacion-maternidad.pdf",
    dependsOn: []
  },
  {
    id: "sv-isss-dependent-enrollment",
    country: "SV", lifeEvents: ["new-baby"], employment: ["employed"],
    name: "Enroll baby as ISSS dependent",
    nameEs: "Inscribir al bebé como dependiente del ISSS",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "Healthcare coverage for your baby within 1 year. Requires RNPN birth certificate first.",
    descriptionEs: "Cobertura médica para tu bebé dentro de 1 año. Requiere partida de nacimiento del RNPN primero.",
    deadline: "Within 1 year of birth", deadlineDays: 365,
    priority: 3, weekToApply: 2,
    documents: ["DUI", "Baby's birth certificate from RNPN"],
    documentsEs: ["Tu DUI", "Partida de nacimiento del bebé (RNPN)"],
    sourceUrl: "https://www.isss.gob.sv",
    officeHours: "Monday–Friday, 7:30am–3:30pm",
    capitalAddress: "Any ISSS departmental office near you",
    universalTip: "You need the RNPN birth certificate BEFORE this step — do not come without it.",
    siteNavigation: "isss.gob.sv → Ciudadano → Servicios → Inscripción de Dependientes (as of May 2026)",
    downloadUrl: "https://www.isss.gob.sv/formularios/inscripcion-dependientes.pdf",
    lastVerified: "2026-05-10", dependsOn: ["sv-rnpn-birth-registration"]
  },
  {
    id: "sv-child-subsidy",
    country: "SV", lifeEvents: ["new-baby"], employment: ["any"],
    name: "Child subsidy",
    nameEs: "Bono por hijo",
    agency: "Government", agencyFull: "Gobierno de El Salvador",
    description: "Monthly subsidy auto-enrolled after birth registration.",
    descriptionEs: "Subsidio mensual. Se tramita automáticamente con el registro de nacimiento.",
    amount: "$50/mo", priority: 4, weekToApply: 2,
    documents: ["Baby's birth certificate"],
    documentsEs: ["Partida de nacimiento del bebé"],
    sourceUrl: "https://www.presidencia.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    universalTip: "This benefit is auto-processed after RNPN registration in most cases. If not received within 30 days, visit your nearest alcaldía.",
    dependsOn: ["sv-rnpn-birth-registration"]
  },
  {
    id: "sv-isss-paternity-benefit",
    country: "SV", lifeEvents: ["new-baby"], employment: ["employed"],
    name: "Paternity benefit (partner)",
    nameEs: "Licencia de paternidad (pareja)",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "3 days paid paternity leave for the father if ISSS-covered.",
    descriptionEs: "3 días de licencia pagada si el padre está cubierto por el ISSS.",
    priority: 5, weekToApply: 1,
    documents: ["Father's DUI", "Baby's birth certificate", "Employer certification"],
    documentsEs: ["DUI del padre", "Partida de nacimiento", "Certificación del patrono"],
    sourceUrl: "https://www.isss.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 7:30am–3:30pm",
    universalTip: "The employer (patrono) must submit this on the father's behalf — give them the baby's birth certificate within the first week.",
  },

  // ── EL SALVADOR — JOB LOSS ─────────────────────────────
  {
    id: "sv-isss-unemployment",
    country: "SV", lifeEvents: ["job-loss"], employment: ["employed"],
    name: "ISSS unemployment benefit",
    nameEs: "Prestación por desempleo del ISSS",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "Monthly benefit for formal workers who lost their job. Requires 12 months continuous contributions.",
    descriptionEs: "Beneficio mensual para trabajadores formales. Requiere 12 meses de cotizaciones continuas.",
    priority: 1, weekToApply: 1,
    documents: ["DUI", "Termination letter", "Last 3 pay stubs", "Bank account statement"],
    documentsEs: ["DUI", "Carta de despido o renuncia", "Últimas 3 colillas de pago", "Estado de cuenta"],
    sourceUrl: "https://www.isss.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 7:30am–3:30pm",
    capitalAddress: "Edificio ISSS Central, 1a Calle Poniente, San Salvador (for other cities, search 'ISSS [your city]')",
    universalTip: "You have 2 months from termination date to apply. Do not wait. Bring your termination letter (carta de despido) — without it the process cannot start.",
    siteNavigation: "isss.gob.sv → Ciudadano → Prestaciones → Desempleo (as of May 2026)",
  },
  {
    id: "sv-insaforp-training",
    country: "SV", lifeEvents: ["job-loss"], employment: ["unemployed", "employed"],
    name: "INSAFORP free job training",
    nameEs: "Capacitación gratuita — INSAFORP",
    agency: "INSAFORP", agencyFull: "Instituto Salvadoreño de Formación Profesional",
    description: "Free vocational training in tech, administration, and trades.",
    descriptionEs: "Cursos gratuitos en tecnología, administración y oficios.",
    priority: 2, weekToApply: 2,
    documents: ["DUI"], documentsEs: ["DUI"],
    sourceUrl: "https://www.insaforp.org.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    universalTip: "Many courses are online and free. Search the catalogue at insaforp.org.sv before going in person — you may not need to visit at all.",
    siteNavigation: "insaforp.org.sv → Catálogo de Cursos (as of May 2026)",
  },

  // ── EL SALVADOR — START BUSINESS ───────────────────────
  {
    id: "sv-conamype-grant",
    country: "SV", lifeEvents: ["start-business"], employment: ["any"],
    name: "CONAMYPE Fondo Productivo grant",
    nameEs: "Fondo Productivo de CONAMYPE",
    agency: "CONAMYPE", agencyFull: "Comisión Nacional de la Micro y Pequeña Empresa",
    description: "Grant up to $2,500 for small businesses. Apply BEFORE registering at CNR — can offset the registration fee.",
    descriptionEs: "Subvención hasta $2,500. Solicitá ANTES del CNR — puede cubrir el costo del registro.",
    amount: "Up to $2,500", priority: 1, weekToApply: 1,
    documents: ["DUI", "Brief business plan", "Bank account"],
    documentsEs: ["DUI", "Plan de negocio (breve)", "Cuenta bancaria"],
    sourceUrl: "https://www.conamype.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    capitalAddress: "CONAMYPE Central, Colonia Roma, San Salvador (for other cities, search 'CONAMYPE [your city]')",
    universalTip: "Apply for this grant BEFORE registering at CNR — the grant can pay for your CNR registration fee. Bring a brief description of your business idea.",
    siteNavigation: "conamype.gob.sv → Servicios Empresariales → Financiamiento (as of May 2026)",
    downloadUrl: "https://www.conamype.gob.sv/formularios/fondo-productivo.pdf"
  },
  {
    id: "sv-cnr-business-registration",
    country: "SV", lifeEvents: ["start-business"], employment: ["any"],
    name: "Business registration at CNR",
    nameEs: "Registro de negocio en el CNR",
    agency: "CNR", agencyFull: "Centro Nacional de Registros",
    description: "Register as a commercial entity. Fee $50–200 depending on capital.",
    descriptionEs: "Registrá tu negocio. Costo $50-200 según el capital declarado.",
    amount: "$50–$200", priority: 2, weekToApply: 1,
    documents: ["DUI", "Business name", "Business address", "Description of activities"],
    documentsEs: ["DUI", "Nombre del negocio", "Dirección", "Descripción de actividades"],
    sourceUrl: "https://www.cnr.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    capitalAddress: "CNR Central, 8a Calle Oriente #310, San Salvador",
    universalTip: "You can start the process online at cnr.gob.sv — only the final signature step requires visiting in person.",
    siteNavigation: "cnr.gob.sv → Registro de Comercio → Matrícula (as of May 2026)",
    blocks: ["sv-mh-nit"]
  },
  {
    id: "sv-mh-nit",
    country: "SV", lifeEvents: ["start-business"], employment: ["any"],
    name: "Tax ID (NIT)",
    nameEs: "NIT — Número de Identificación Tributaria",
    agency: "Ministerio de Hacienda",
    agencyFull: "Ministerio de Hacienda de El Salvador",
    description: "Register for taxes after CNR registration.",
    descriptionEs: "Registrate como contribuyente después del CNR.",
    priority: 3, weekToApply: 1,
    documents: ["DUI", "CNR registration certificate"],
    documentsEs: ["DUI", "Matrícula del CNR"],
    sourceUrl: "https://www.mh.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    universalTip: "The NIT can be obtained entirely online at mh.gob.sv — no office visit needed. Do this before your CNR appointment.",
    siteNavigation: "mh.gob.sv → Servicios → NIT → Inscripción en Línea (as of May 2026)",
    dependsOn: ["sv-cnr-business-registration"]
  },
  {
    id: "sv-alcaldia-operating-licence",
    country: "SV", lifeEvents: ["start-business"], employment: ["any"],
    name: "Municipal operating licence",
    nameEs: "Licencia de funcionamiento — Alcaldía",
    agency: "Alcaldía", agencyFull: "Alcaldía / Distrito correspondiente",
    description: "Required after CNR and NIT. Since 2024: 262 municipalities → 44 districts. Verify your correct alcaldía first.",
    descriptionEs: "Requerida después del CNR y NIT. Desde 2024: 262 municipios → 44 distritos. Verificá tu alcaldía correcta primero.",
    priority: 4, weekToApply: 2,
    documents: ["DUI", "CNR certificate", "NIT certificate", "Business address proof"],
    documentsEs: ["DUI", "Matrícula CNR", "NIT", "Comprobante de dirección"],
    sourceUrl: "https://sansalvador.eregulations.org", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    universalTip: "Since 2024, El Salvador has 44 districts not 262 municipalities. Tell me your city and I will tell you which district office to go to.",
    dependsOn: ["sv-cnr-business-registration", "sv-mh-nit"]
  },

  // ── EL SALVADOR — DIASPORA / PODER NOTARIAL ────────────
  {
    id: "sv-poder-notarial-diaspora",
    country: "SV",
    lifeEvents: ["diaspora", "property"],
    employment: ["any"],
    name: "Power of attorney (poder notarial) from abroad",
    nameEs: "Poder notarial desde el extranjero",
    agency: "RREES",
    agencyFull: "Ministerio de Relaciones Exteriores — Red Consular",
    description: "Grant legal authority to someone in El Salvador to act on your behalf for property sales, inheritance, or legal matters. Required 3-step process: US notary → apostille → RREES/CNR in El Salvador.",
    descriptionEs: "Otorgá autorización legal a alguien en El Salvador para actuar en tu nombre. Proceso de 3 pasos: notario en EEUU → apostilla → RREES/CNR en El Salvador.",
    amount: "$40 consulate fee",
    priority: 1, weekToApply: 1,
    documents: [
      "Your valid passport or DUI",
      "Details of what the poder covers (property address, specific transaction)",
      "Name and DUI of the person receiving the poder in El Salvador"
    ],
    documentsEs: [
      "Tu pasaporte o DUI vigente",
      "Detalles de lo que cubre el poder (dirección del inmueble, transacción específica)",
      "Nombre y DUI de la persona que recibirá el poder en El Salvador"
    ],
    sourceUrl: "https://rree.gob.sv",
    lastVerified: "2026-05-19",
    officeHours: "Consulate hours vary by city — check rree.gob.sv for your nearest consulate",
    universalTip: "Book your consulate appointment online at rree.gob.sv before going. Walk-in appointments are rarely available. The cost is $40 at the consulate.",
    siteNavigation: "rree.gob.sv → Servicios Consulares → Actos Notariales → Citas (as of May 2026)",
    dependsOn: []
  },
]

export function lookupServices(params: {
  country: string
  lifeEvent: string
  employment: string
}): Service[] {
  const results = services
    .filter(s =>
      s.country === params.country &&
      s.lifeEvents.includes(params.lifeEvent) &&
      (
        params.employment === "any" ||
        s.employment.includes(params.employment) ||
        s.employment.includes("any")
      )
    )
    .sort((a, b) => a.priority - b.priority)
  console.log("KB lookup:", params, "→", results.length, "services")
  return results
}

// ── LIVE KB LOOKUP (Supabase → static fallback) ───────
// Returns the same Service shape so callers don't need to change.
// Falls back to static KB if Supabase is unavailable or returns 0 results.
export async function lookupServicesDB(params: {
  country: string
  lifeEvent: string
  employment: string
}): Promise<Service[]> {
  try {
    // Dynamic import avoids bundling supabase client in non-engine builds
    const { searchSchemes } = await import("./engine/db")
    const rows = await searchSchemes({
      country: params.country,
      lifeEvent: params.lifeEvent,
      employment: params.employment,
      limit: 20,
    })

    if (rows.length === 0) {
      // Nothing approved yet — fall back to static KB
      return lookupServices(params)
    }

    // Map Supabase row shape → Service shape
    return rows.map((r, i) => ({
      id: r.id as string,
      country: r.country as string,
      lifeEvents: (r.life_events as string[]) ?? [],
      employment: (r.employment_types as string[]) ?? ["any"],
      name: r.scheme_name as string,
      nameEs: (r.scheme_name_es as string) ?? (r.scheme_name as string),
      agency: r.agency as string,
      agencyFull: (r.agency_full as string) ?? (r.agency as string),
      description: (r.description as string) ?? "",
      descriptionEs: (r.description_es as string) ?? (r.description as string) ?? "",
      amount: (r.amount as string) ?? undefined,
      deadlineDays: (r.deadline_days as number) ?? undefined,
      deadline: r.deadline_days ? `${r.deadline_days} days` : undefined,
      priority: i + 1,
      weekToApply: Math.floor(i / 2) + 1,
      documents: (r.documents_required as string[]) ?? [],
      documentsEs: (r.documents_required_es as string[]) ?? [],
      sourceUrl: (r.official_link as string) ?? "",
      lastVerified: r.last_verified
        ? new Date(r.last_verified as string).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      officeHours: (r.office_hours as string) ?? undefined,
    }))
  } catch (err) {
    console.warn("[KB] Supabase lookup failed, falling back to static KB:", err)
    return lookupServices(params)
  }
}

export function sequencePlan(svcs: Service[]): Service[][] {
  const weeks: Service[][] = [[], [], [], []]
  const completed = new Set<string>()
  const canDo = (s: Service) =>
    !s.dependsOn || s.dependsOn.every(dep => completed.has(dep))
  let remaining = [...svcs]
  let weekIndex = 0
  while (remaining.length > 0 && weekIndex < 4) {
    const doable = remaining.filter(canDo)
    if (doable.length === 0) break
    doable.forEach(s => { weeks[weekIndex].push(s); completed.add(s.id) })
    remaining = remaining.filter(s => !completed.has(s.id))
    weekIndex++
  }
  return weeks.filter(w => w.length > 0)
}
