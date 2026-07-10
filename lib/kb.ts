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
  phaseToApply: number
  documents: string[]
  documentsEs: string[]
  steps?: string[]
  stepsEs?: string[]
  sourceUrl: string
  lastVerified: string
  dependsOn?: string[]
  blocks?: string[]
  officeHours?: string
  capitalAddress?: string
  universalTip?: string
  siteNavigation?: string
  confidence?: number        // 0..1, from research; low = unverified
  reviewStatus?: "needs_review" | "approved"
  // True when the real-world cost is genuinely tiered/variable (not a single
  // number) even though the entry itself is approved/high-confidence — the
  // reply/plan must frame it as "varies" and never state one flat figure as
  // THE cost. Independent of reviewStatus/confidence, which grade factual
  // accuracy, not whether a single number can honestly represent the cost.
  costUncertain?: boolean
  // Slot-filling (Task S1): suppress this service from retrieval when a known
  // slot value matches — e.g. don't surface Matrícula de Empresa once the
  // citizen has confirmed they're a solo/below-threshold vendor. Deterministic
  // input-side filtering; never touches grounding/plan-verify logic itself.
  suppressWhenSlot?: { key: string; matches: string[] }
}

export const services: Service[] = [
  // ── EL SALVADOR — NEW BABY ─────────────────────────────
  {
    id: "sv-rnpn-birth-registration",
    country: "SV", lifeEvents: ["new-baby"], employment: ["any"],
    name: "Birth certificate (certificación de partida) — RNPN",
    nameEs: "Certificación de partida de nacimiento — RNPN",
    agency: "RNPN", agencyFull: "Registro Nacional de las Personas Naturales",
    description: "Get the official birth certificate (certificación de partida) for your baby from RNPN — required before ISSS dependent enrollment and the child subsidy. Cost depends on use: about $3–$5 for domestic use (still issued by alcaldías, varies by municipality); $20 for an authenticated partida for use abroad — as of June 25, 2026 this is issued exclusively by RNPN (not alcaldías), at the RNPN Central Office or a DUI Centro (Santa Ana, San Miguel, Usulután, etc.); and about $35 for consular/online certification requested from abroad via Simple SV — a fee waiver for citizens abroad was under legislative consideration, so confirm the current cost. Using Simple SV itself is free — the costs above are per-document fees set by the issuing institution, not the platform.",
    descriptionEs: "Obtené la certificación de partida de nacimiento de tu bebé en el RNPN — se requiere antes de inscribir al bebé en el ISSS y del bono por hijo. El costo depende del uso: cerca de $3–$5 para uso doméstico (todavía la emiten las alcaldías, varía por municipio); $20 por una partida autenticada para uso en el exterior — desde el 25 de junio de 2026 la emite exclusivamente el RNPN (no las alcaldías), en la Oficina Central del RNPN o un Centro DUI (Santa Ana, San Miguel, Usulután, etc.); y cerca de $35 por certificación consular/en línea solicitada desde el exterior vía Simple SV — se estaba considerando una exoneración legislativa de esta tarifa para connacionales en el exterior, así que confirmá el costo actual. Usar la plataforma Simple SV en sí es gratis — los costos anteriores son tarifas por documento que fija la institución emisora, no la plataforma.",
    deadline: "30 days after birth", deadlineDays: 30,
    priority: 1, phaseToApply: 1,
    documents: ["Your DUI", "Hospital discharge certificate", "Father's DUI (if applicable)"],
    documentsEs: ["Tu DUI", "Constancia de alta del hospital", "DUI del padre (si aplica)"],
    sourceUrl: "https://www.rnpn.gob.sv/servicios/certificacion-de-partidas-en-el-salvador/", lastVerified: "2026-07-04",
    officeHours: "Monday–Friday, 8:00am–3:30pm",
    capitalAddress: "Centro Gubernamental, Alameda Juan Pablo II, San Salvador (for other cities, search 'RNPN [your city]')",
    amount: "Varies by use: ~$3–5 domestic (via alcaldía, varies by municipality), $20 abroad-authenticated (RNPN only since June 25, 2026), ~$35 consular via Simple SV (fee waiver pending legislative approval — confirm current cost)",
    costUncertain: true,
    universalTip: "For domestic use: about $3–$5 at your local alcaldía (varies by municipality). For use abroad: an authenticated partida now costs $20 and, since June 25, 2026, is issued only by RNPN (not alcaldías) — go to the RNPN Central Office or a DUI Centro (Santa Ana, San Miguel, Usulután, etc.). If requesting from abroad via Simple SV, the certification is reported around $35, but a fee waiver for citizens abroad was under legislative consideration — confirm the current cost before paying. Simple SV itself is free to use; the fee is charged by the issuing institution per document.",
    siteNavigation: "rnpn.gob.sv → Servicios → Inscripción de Nacimiento (as of May 2026)",
    confidence: 0.85,
    reviewStatus: "approved",
    blocks: ["sv-isss-dependent-enrollment", "sv-child-subsidy"]
  },
  {
    id: "sv-isss-maternity-benefit",
    country: "SV", lifeEvents: ["new-baby"], employment: ["formal"],
    name: "Maternity benefit (subsidio por maternidad)",
    nameEs: "Subsidio por maternidad (ISSS)",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "16 weeks (112 days) of paid maternity leave for ISSS-insured (formally employed) mothers, with at least 10 weeks taken after birth. You receive your full salary — ISSS covers 100% of your insured base salary, and your employer tops up any difference. Requires 16 weeks of contributions in the 12 months before your presumed birth month, and 6 months with the same employer before your probable due date.",
    descriptionEs: "16 semanas (112 días) de licencia por maternidad pagada para madres aseguradas por el ISSS (empleo formal), con al menos 10 semanas después del parto. Recibís tu salario completo — el ISSS cubre el 100% de tu salario base cotizado, y tu empleador cubre cualquier diferencia. Requiere 16 semanas cotizadas en los 12 meses antes del mes probable de parto, y 6 meses con el mismo empleador antes de la fecha probable de parto.",
    deadline: "16 weeks (112 days) of leave, at least 10 weeks after birth", deadlineDays: 112,
    priority: 2, phaseToApply: 1,
    documents: ["DUI", "Hospital discharge certificate", "ISSS referral form"],
    documentsEs: ["DUI", "Constancia del hospital", "Hoja de referencia del ISSS"],
    sourceUrl: "https://elsalvador.eregulations.org/media/ley%20del%20seguro%20social.pdf", lastVerified: "2026-07-04",
    officeHours: "Monday–Friday, 7:30am–3:30pm",
    capitalAddress: "Edificio ISSS Central, 1a Calle Poniente, San Salvador (for other cities, search 'ISSS [your city]')",
    // Deliberately short, separated sentences (not one dense paragraph) — a
    // grounding-judge experiment (Task J1) found the original single-paragraph
    // version, packing 5 distinct facts into 2 long sentences, was genuinely
    // too dense for the LLM faithfulness judge to reliably cross-reference
    // against a reply, even in complete isolation. Same facts, same citations,
    // just split for machine-readability — not a factual change.
    universalTip: "You receive your full salary during leave. ISSS pays 100% of your insured base salary. Your employer covers any remaining difference up to your full salary. (Legal basis: Labor Code Art. 309, as amended by Decreto Legislativo 143/2015; ISSS Reglamento Arts. 25, 26, 28.) Eligibility: 16 weeks of contributions in the 12 months before your presumed birth month. Also requires 6 months with your current employer before your probable due date.",
    siteNavigation: "isss.gob.sv → Ciudadano → Prestaciones → Maternidad (as of May 2026)",
    downloadUrl: "https://www.isss.gob.sv/formularios/solicitud-prestacion-maternidad.pdf",
    confidence: 0.9,
    reviewStatus: "approved",
    dependsOn: []
  },
  {
    id: "sv-isss-dependent-enrollment",
    country: "SV", lifeEvents: ["new-baby"], employment: ["formal"],
    name: "Enroll baby as ISSS dependent",
    nameEs: "Inscribir al bebé como dependiente del ISSS",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "Healthcare coverage for your baby within 1 year. Requires RNPN birth certificate first.",
    descriptionEs: "Cobertura médica para tu bebé dentro de 1 año. Requiere partida de nacimiento del RNPN primero.",
    deadline: "Within 1 year of birth", deadlineDays: 365,
    priority: 3, phaseToApply: 2,
    documents: ["DUI", "Baby's birth certificate from RNPN"],
    documentsEs: ["Tu DUI", "Partida de nacimiento del bebé (RNPN)"],
    sourceUrl: "https://www.isss.gob.sv",
    officeHours: "Monday–Friday, 7:30am–3:30pm",
    capitalAddress: "Any ISSS departmental office near you",
    universalTip: "You need the RNPN birth certificate BEFORE this step — do not come without it.",
    siteNavigation: "isss.gob.sv → Ciudadano → Servicios → Inscripción de Dependientes (as of May 2026)",
    downloadUrl: "https://www.isss.gob.sv/formularios/inscripcion-dependientes.pdf",
    lastVerified: "2026-05-10", dependsOn: ["sv-rnpn-birth-registration"],
    // KB annotation audit: unannotated, carries a deadline + eligibility claim
    // — added to the human-review worklist.
    reviewStatus: "needs_review",
  },
  {
    id: "sv-child-subsidy",
    country: "SV", lifeEvents: ["new-baby"], employment: ["any"],
    name: "Child subsidy",
    nameEs: "Bono por hijo",
    agency: "Government", agencyFull: "Gobierno de El Salvador",
    description: "Monthly subsidy auto-enrolled after birth registration.",
    descriptionEs: "Subsidio mensual. Se tramita automáticamente con el registro de nacimiento.",
    amount: "$50/mo", priority: 4, phaseToApply: 2,
    documents: ["Baby's birth certificate"],
    documentsEs: ["Partida de nacimiento del bebé"],
    sourceUrl: "https://www.presidencia.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    universalTip: "This benefit is auto-processed after RNPN registration in most cases. If not received within 30 days, visit your nearest alcaldía.",
    dependsOn: ["sv-rnpn-birth-registration"],
    // KB annotation audit: unannotated, carries a cost + auto-enrollment claim
    // — added to the human-review worklist.
    reviewStatus: "needs_review",
  },
  {
    id: "sv-isss-paternity-benefit",
    country: "SV", lifeEvents: ["new-baby"], employment: ["formal"],
    name: "Paternity benefit (partner)",
    nameEs: "Licencia de paternidad (pareja)",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "3 days paid paternity leave for the father if ISSS-covered.",
    descriptionEs: "3 días de licencia pagada si el padre está cubierto por el ISSS.",
    priority: 5, phaseToApply: 1,
    documents: ["Father's DUI", "Baby's birth certificate", "Employer certification"],
    documentsEs: ["DUI del padre", "Partida de nacimiento", "Certificación del patrono"],
    sourceUrl: "https://www.isss.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 7:30am–3:30pm",
    universalTip: "The employer (patrono) must submit this on the father's behalf — give them the baby's birth certificate within the first week.",
    // KB annotation audit: unannotated, carries a specific day-count benefit
    // claim — added to the human-review worklist.
    reviewStatus: "needs_review",
  },

  // ── EL SALVADOR — JOB LOSS ─────────────────────────────
  {
    id: "sv-isss-unemployment",
    country: "SV", lifeEvents: ["job-loss"], employment: ["formal"],
    name: "ISSS unemployment benefit",
    nameEs: "Prestación por desempleo del ISSS",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "Monthly benefit for formal workers who lost their job. Requires 12 months continuous contributions.",
    descriptionEs: "Beneficio mensual para trabajadores formales. Requiere 12 meses de cotizaciones continuas.",
    priority: 1, phaseToApply: 1,
    documents: ["DUI", "Termination letter", "Last 3 pay stubs", "Bank account statement"],
    documentsEs: ["DUI", "Carta de despido o renuncia", "Últimas 3 colillas de pago", "Estado de cuenta"],
    sourceUrl: "https://www.isss.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 7:30am–3:30pm",
    capitalAddress: "Edificio ISSS Central, 1a Calle Poniente, San Salvador (for other cities, search 'ISSS [your city]')",
    universalTip: "You have 2 months from termination date to apply. Do not wait. Bring your termination letter (carta de despido) — without it the process cannot start.",
    siteNavigation: "isss.gob.sv → Ciudadano → Prestaciones → Desempleo (as of May 2026)",
    // KB annotation audit: unannotated, carries an eligibility rule + deadline
    // claim — added to the human-review worklist.
    reviewStatus: "needs_review",
  },
  {
    id: "sv-insaforp-training",
    country: "SV", lifeEvents: ["job-loss"], employment: ["unemployed", "formal"],
    name: "INSAFORP free job training",
    nameEs: "Capacitación gratuita — INSAFORP",
    agency: "INSAFORP", agencyFull: "Instituto Salvadoreño de Formación Profesional",
    description: "Free vocational training in tech, administration, and trades.",
    descriptionEs: "Cursos gratuitos en tecnología, administración y oficios.",
    priority: 2, phaseToApply: 2,
    documents: ["DUI"], documentsEs: ["DUI"],
    sourceUrl: "https://www.insaforp.org.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    universalTip: "Many courses are online and free. Search the catalogue at insaforp.org.sv before going in person — you may not need to visit at all.",
    siteNavigation: "insaforp.org.sv → Catálogo de Cursos (as of May 2026)",
    // KB annotation audit: INSAFORP has been dissolved/restructured into INCAF —
    // agency name, URL, and process details below are stale pending content
    // rewrite (Spanish human review owed). Marked needs_review so grounding
    // hedges these facts instead of treating them as trusted/verified.
    reviewStatus: "needs_review",
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
    amount: "Up to $2,500", priority: 1, phaseToApply: 1,
    documents: ["DUI", "Brief business plan", "Bank account"],
    documentsEs: ["DUI", "Plan de negocio (breve)", "Cuenta bancaria"],
    sourceUrl: "https://www.conamype.gob.sv", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    capitalAddress: "CONAMYPE Central, Colonia Roma, San Salvador (for other cities, search 'CONAMYPE [your city]')",
    universalTip: "Apply for this grant BEFORE registering at CNR — the grant can pay for your CNR registration fee. Bring a brief description of your business idea.",
    siteNavigation: "conamype.gob.sv → Servicios Empresariales → Financiamiento (as of May 2026)",
    downloadUrl: "https://www.conamype.gob.sv/formularios/fondo-productivo.pdf",
    // KB annotation audit: unannotated, carries a $2,500 amount claim —
    // added to the human-review worklist.
    reviewStatus: "needs_review",
  },
  {
    id: "sv-cnr-business-registration",
    country: "SV", lifeEvents: ["start-business"], employment: ["any"],
    name: "Business registration (Matrícula de Empresa) — CNR",
    nameEs: "Matrícula de Empresa — CNR",
    agency: "CNR", agencyFull: "Centro Nacional de Registros",
    description: "Formal commercial registration (Matrícula de Empresa) is required only for businesses with $12,000+ in assets. Below that, you need a Tax ID (NIT) and municipal registration instead.",
    descriptionEs: "La Matrícula de Empresa es obligatoria solo para negocios con $12,000 o más en activos. Por debajo de eso, necesitás el NIT y el registro municipal en su lugar.",
    amount: "~$17.14 balance-deposit fee (individual-merchant base fee unconfirmed)", priority: 2, phaseToApply: 1,
    documents: ["DUI", "Business name", "Business address", "Description of activities"],
    documentsEs: ["DUI", "Nombre del negocio", "Dirección", "Descripción de actividades"],
    sourceUrl: "https://www.cnr.gob.sv/servicios/detalle-de-servicios-del-registro-de-comercio/", lastVerified: "2026-05-10",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    capitalAddress: "CNR Central, 8a Calle Oriente #310, San Salvador",
    universalTip: "IMPORTANT: only require a Matrícula de Empresa if the citizen's business assets are $12,000 or more. Below that threshold, do NOT tell them to get a Matrícula — they only need a NIT (Ministerio de Hacienda) and municipal registration. First-year-free applies specifically to S.A.S. companies (Decreto 905), not all merchants — don't assume it applies.",
    confidence: 0.75,
    reviewStatus: "needs_review",
    siteNavigation: "cnr.gob.sv → Registro de Comercio → Matrícula (as of May 2026)",
    blocks: ["sv-mh-nit"],
    suppressWhenSlot: { key: "businessSizeTier", matches: ["solo"] }
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
    priority: 3, phaseToApply: 1,
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
    priority: 4, phaseToApply: 2,
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
    description: "Grant legal authority to someone in El Salvador to act on your behalf for property sales, inheritance, or legal matters. The notarial act must be performed by someone with Salvadoran notarial authority — a Salvadoran consul (recommended: cheaper, in person at your nearest consulate) or a notary authorized by El Salvador's Supreme Court. A US notary public CANNOT supply Salvadoran public faith — a US notary plus apostille is NOT a valid substitute and can be rejected by the CNR, courts, or other entities. After the consul grants the poder, it must be authenticated at the Ministerio de Relaciones Exteriores before use in El Salvador. For judicial/court matters, the final apoderado must be a lawyer of the Republic (a non-lawyer can receive the poder, but it must be substituted to a lawyer before being exercised in court).",
    descriptionEs: "Otorgá autorización legal a alguien en El Salvador para actuar en tu nombre en ventas de propiedad, herencias u otros trámites legales. El acto notarial debe ser realizado por alguien con fe pública salvadoreña — un cónsul salvadoreño (recomendado: más económico, en persona en tu consulado más cercano) o un notario autorizado por la Corte Suprema de Justicia. Un notario de EEUU NO puede dar fe pública salvadoreña — un notario de EEUU más apostilla NO es un sustituto válido y puede ser rechazado por el CNR, tribunales u otras entidades. Después de que el cónsul otorgue el poder, debe autenticarse en el Ministerio de Relaciones Exteriores antes de usarse en El Salvador. Para trámites judiciales, el apoderado final debe ser un abogado de la República (se le puede otorgar el poder a alguien que no sea abogado, pero debe sustituirse a un abogado antes de ejercerlo en un tribunal).",
    amount: "~$40 (reported, unconfirmed) — consular route is cheaper than the notary route; confirm with your consulate",
    priority: 1, phaseToApply: 1,
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
    sourceUrl: "https://elsalvador.eregulations.org/media/Ley%20de%20Notariado.pdf",
    lastVerified: "2026-07-04",
    officeHours: "Consulate hours vary by city — check rree.gob.sv for your nearest consulate",
    universalTip: "Recommended route: grant the poder before a Salvadoran consul (cheaper, in person) rather than a Supreme-Court-authorized notary. A US notary plus apostille does NOT work for a legal poder in El Salvador — it can be rejected by the CNR, courts, or other entities. After the consulate grants the poder, it must also be authenticated at the Ministerio de Relaciones Exteriores before it can be used in El Salvador. If the poder will be used in court, the apoderado must ultimately be a licensed Salvadoran lawyer. Cost: the consular route is cheaper than a notary, but the exact fee is not confirmed (reported around $40) — always verify the current fee with the specific consulate.",
    siteNavigation: "rree.gob.sv → Servicios Consulares → Actos Notariales → Citas (as of May 2026)",
    confidence: 0.85,
    reviewStatus: "approved",
    dependsOn: []
  },

  // ── EL SALVADOR — MARRIAGE ─────────────────────────────
  {
    id: "sv-rnpn-civil-marriage",
    country: "SV", lifeEvents: ["marriage"], employment: ["any"],
    name: "Civil marriage registration at RNPN",
    nameEs: "Matrimonio civil en el RNPN",
    agency: "RNPN", agencyFull: "Registro Nacional de las Personas Naturales",
    description: "Register your civil marriage with the RNPN. Required before updating DUI, ISSS beneficiary status, or any legal name change.",
    descriptionEs: "Registrá tu matrimonio civil en el RNPN. Necesario antes de actualizar el DUI, ISSS o cualquier cambio de nombre legal.",
    priority: 1, phaseToApply: 1,
    documents: ["Both DUIs", "Witness DUIs (2 witnesses)", "Marriage certificate from officiant (if civil ceremony held separately)"],
    documentsEs: ["Ambos DUIs", "DUIs de testigos (2 testigos)", "Acta del matrimonio del oficial si la ceremonia fue por separado"],
    sourceUrl: "https://www.rnpn.gob.sv", lastVerified: "2026-05-25",
    officeHours: "Monday–Friday, 8:00am–3:30pm",
  },
  {
    id: "sv-isss-spouse-enrollment",
    country: "SV", lifeEvents: ["marriage"], employment: ["formal"],
    name: "ISSS spouse / beneficiary enrollment",
    nameEs: "Inscripción de cónyuge como beneficiario ISSS",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "Enroll your spouse as an ISSS beneficiary within 30 days of marriage to give them access to social security healthcare.",
    descriptionEs: "Inscribí a tu cónyuge como beneficiario del ISSS dentro de 30 días del matrimonio para darle acceso a los servicios médicos.",
    deadline: "30 days after marriage", deadlineDays: 30,
    priority: 2, phaseToApply: 1,
    documents: ["Your DUI", "Marriage certificate", "Spouse's DUI"],
    documentsEs: ["Tu DUI", "Acta de matrimonio", "DUI del cónyuge"],
    sourceUrl: "https://www.isss.gob.sv", lastVerified: "2026-05-25",
    officeHours: "Monday–Friday, 8:00am–3:30pm",
    // KB annotation audit: unannotated, carries a 30-day deadline claim —
    // added to the human-review worklist.
    reviewStatus: "needs_review",
  },

  // ── EL SALVADOR — DEATH / BEREAVEMENT ──────────────────
  {
    id: "sv-rnpn-death-certificate",
    country: "SV", lifeEvents: ["death"], employment: ["any"],
    name: "Death registration and certificate (RNPN)",
    nameEs: "Registro de defunción y partida de defunción (RNPN)",
    agency: "RNPN", agencyFull: "Registro Nacional de las Personas Naturales",
    description: "Register a death within 8 days. Required before any inheritance, pension claim, or estate procedure can begin.",
    descriptionEs: "Registrá el fallecimiento dentro de 8 días. Necesario antes de cualquier herencia, pensión o trámite sucesorio.",
    deadline: "8 days after death", deadlineDays: 8,
    priority: 1, phaseToApply: 1,
    documents: ["Medical death certificate from hospital/doctor", "Deceased's DUI", "Your DUI (the person reporting)"],
    documentsEs: ["Certificado médico de defunción del hospital/médico", "DUI del fallecido", "Tu DUI (quien reporta)"],
    sourceUrl: "https://www.rnpn.gob.sv", lastVerified: "2026-05-25",
    officeHours: "Monday–Friday, 8:00am–3:30pm",
    universalTip: "The hospital usually provides the medical death certificate. Bring originals AND photocopies of all documents.",
    // KB annotation audit: unannotated, carries an 8-day deadline claim —
    // added to the human-review worklist.
    reviewStatus: "needs_review",
  },
  {
    id: "sv-afp-survivor-pension",
    country: "SV", lifeEvents: ["death"], employment: ["any"],
    name: "AFP survivor pension claim",
    nameEs: "Pensión de sobrevivencia AFP",
    agency: "AFP", agencyFull: "Administradoras de Fondos de Pensiones",
    description: "If the deceased was contributing to an AFP (CRECER or CONFÍA), surviving spouse and children can claim a survivor pension.",
    descriptionEs: "Si el fallecido cotizaba a una AFP (CRECER o CONFÍA), el cónyuge e hijos pueden reclamar una pensión de sobrevivencia.",
    priority: 2, phaseToApply: 2,
    documents: ["Death certificate", "Your DUI", "Marriage certificate or birth certificates of children", "AFP account number of deceased"],
    documentsEs: ["Partida de defunción", "Tu DUI", "Acta de matrimonio o partidas de nacimiento de los hijos", "Número de cuenta AFP del fallecido"],
    sourceUrl: "https://www.spensiones.gob.sv", lastVerified: "2026-05-25",
    // KB annotation audit: the Superintendencia de Pensiones (spensiones.gob.sv)
    // was restructured into the SSF + ISP — agency name, URL, and process
    // details below are stale pending content rewrite (Spanish human review
    // owed). Marked needs_review so grounding hedges these facts instead of
    // treating them as trusted/verified.
    reviewStatus: "needs_review",
  },

  // ── EL SALVADOR — RETIREMENT ───────────────────────────
  {
    id: "sv-afp-retirement-pension",
    country: "SV", lifeEvents: ["retirement"], employment: ["formal", "informal"],
    name: "AFP retirement pension claim",
    nameEs: "Pensión de vejez AFP",
    agency: "AFP", agencyFull: "Administradoras de Fondos de Pensiones (CRECER / CONFÍA)",
    description: "Claim your retirement pension from your AFP. Men can retire at 60 (with 25 years contributions), women at 55 (with 25 years).",
    descriptionEs: "Solicitá tu pensión de vejez en tu AFP. Hombres pueden jubilarse a los 60 años (con 25 años cotizados), mujeres a los 55 (con 25 años).",
    priority: 1, phaseToApply: 1,
    documents: ["DUI", "AFP account details", "Employment history / payslips as evidence of contributions", "Proof of age (DUI or birth certificate)"],
    documentsEs: ["DUI", "Datos de cuenta AFP", "Historial laboral / colillas de cotización", "Prueba de edad (DUI o partida de nacimiento)"],
    sourceUrl: "https://www.spensiones.gob.sv", lastVerified: "2026-05-25",
    universalTip: "Contact your AFP directly (CRECER or CONFÍA) to start the process. They will tell you your current balance and eligibility date.",
    // KB annotation audit: the Superintendencia de Pensiones (spensiones.gob.sv)
    // was restructured into the SSF + ISP — agency name, URL, and process
    // details below are stale pending content rewrite (Spanish human review
    // owed). Marked needs_review so grounding hedges these facts instead of
    // treating them as trusted/verified.
    reviewStatus: "needs_review",
  },
  {
    id: "sv-isss-retirement",
    country: "SV", lifeEvents: ["retirement"], employment: ["formal"],
    name: "ISSS retirement benefit",
    nameEs: "Prestación de vejez ISSS",
    agency: "ISSS", agencyFull: "Instituto Salvadoreño del Seguro Social",
    description: "If you contributed to ISSS before 1998 (pre-AFP system), you may be entitled to an ISSS old-age pension in addition to or instead of AFP.",
    descriptionEs: "Si cotizaste al ISSS antes de 1998 (sistema pre-AFP), podés tener derecho a una pensión de vejez del ISSS además de o en lugar de la AFP.",
    priority: 2, phaseToApply: 1,
    documents: ["DUI", "Contribution records (if available)", "Employment certificates for pre-1998 work"],
    documentsEs: ["DUI", "Registros de cotización (si disponibles)", "Certificados de trabajo anterior a 1998"],
    sourceUrl: "https://www.isss.gob.sv", lastVerified: "2026-05-25",
    officeHours: "Monday–Friday, 7:30am–3:30pm",
    // KB annotation audit: unannotated, carries a pre-1998 eligibility rule
    // claim — added to the human-review worklist.
    reviewStatus: "needs_review",
  },

  // ── EL SALVADOR — DRIVER'S LICENSE ─────────────────────
  {
    id: "sv-vmt-drivers-license-first",
    country: "SV", lifeEvents: ["driving-license"], employment: ["any"],
    name: "First-time driver's license (VMT)",
    nameEs: "Licencia de conducir por primera vez (VMT)",
    agency: "VMT", agencyFull: "Viceministerio de Transporte",
    description: "Obtain your first driver's license. Requires passing a written theory test and a practical driving test at a VMT office.",
    descriptionEs: "Obtené tu primera licencia de conducir. Requiere aprobar un examen teórico escrito y uno práctico en la oficina del VMT.",
    priority: 1, phaseToApply: 1,
    documents: ["DUI", "Medical certificate (from authorized doctor)", "Blood type certificate", "Proof of address", "3x3 cm photo"],
    documentsEs: ["DUI", "Certificado médico (médico autorizado)", "Certificado de tipo de sangre", "Comprobante de domicilio", "Foto 3x3 cm"],
    sourceUrl: "https://www.mop.gob.sv/vmt/", lastVerified: "2026-05-25",
    officeHours: "Monday–Friday, 8:00am–3:00pm",
    universalTip: "Schedule your theory test appointment at the VMT office. Study the Reglamento General de Tránsito — the test is based on it.",
  },
  {
    id: "sv-vmt-drivers-license-renewal",
    country: "SV", lifeEvents: ["driving-license"], employment: ["any"],
    name: "Driver's license renewal (VMT)",
    nameEs: "Renovación de licencia de conducir (VMT)",
    agency: "VMT", agencyFull: "Viceministerio de Transporte",
    description: "Renew your driver's license before it expires. Can be done up to 60 days before expiry. Cost is around $18.",
    descriptionEs: "Renovás tu licencia de conducir antes de que venza. Se puede hacer hasta 60 días antes del vencimiento. El costo es de alrededor de $18.",
    amount: "~$18",
    priority: 1, phaseToApply: 1,
    documents: ["Current (or expired) driver's license", "DUI", "Medical certificate (from authorized doctor)", "Payment receipt"],
    documentsEs: ["Licencia actual (o vencida)", "DUI", "Certificado médico (médico autorizado)", "Recibo de pago"],
    sourceUrl: "https://www.mop.gob.sv/vmt/", lastVerified: "2026-05-25",
    officeHours: "Monday–Friday, 8:00am–3:00pm",
    // KB annotation audit: unannotated, carries a ~$18 cost claim — added
    // to the human-review worklist.
    reviewStatus: "needs_review",
  },

  // ── EL SALVADOR — PROPERTY ─────────────────────────────
  {
    id: "sv-cnr-property-transfer",
    country: "SV", lifeEvents: ["property"], employment: ["any"],
    name: "Property title transfer (CNR)",
    nameEs: "Traspaso de inmueble (CNR)",
    agency: "CNR", agencyFull: "Centro Nacional de Registros",
    description: "Register the transfer of property ownership after buying or selling. Requires a notarized public deed (escritura pública) and registration at the CNR.",
    descriptionEs: "Registrá la transferencia de propiedad después de comprar o vender. Requiere escritura pública notariada e inscripción en el CNR.",
    priority: 1, phaseToApply: 1,
    documents: ["Notarized public deed (escritura pública)", "Both parties' DUIs", "NIT numbers", "Tax clearance certificate (solvencia)", "Property valuation"],
    documentsEs: ["Escritura pública notariada", "DUIs de ambas partes", "NITs", "Solvencia municipal", "Avalúo del inmueble"],
    sourceUrl: "https://www.cnr.gob.sv", lastVerified: "2026-05-25",
    officeHours: "Monday–Friday, 8:00am–3:30pm",
    universalTip: "You must hire a notary to draft the escritura pública. The notary typically handles the CNR registration as part of the service. Budget for transfer taxes (~3% of property value).",
    // KB annotation audit: unannotated, carries a ~3% transfer-tax figure —
    // added to the human-review worklist.
    reviewStatus: "needs_review",
  },

  // ── EL SALVADOR — EDUCATION / TRAINING ────────────────
  {
    id: "sv-insaforp-free-training",
    country: "SV", lifeEvents: ["education", "job-loss"], employment: ["unemployed", "informal", "any"],
    name: "Free vocational training (INSAFORP)",
    nameEs: "Capacitación vocacional gratuita (INSAFORP)",
    agency: "INSAFORP", agencyFull: "Instituto Salvadoreño de Formación Profesional",
    description: "Free technical and vocational training courses in areas like cooking, electrical, computing, beauty, and construction. Open to all Salvadorans.",
    descriptionEs: "Cursos técnicos y vocacionales gratuitos en cocina, electricidad, computación, belleza y construcción. Abierto a todos los salvadoreños.",
    priority: 1, phaseToApply: 1,
    documents: ["DUI", "Birth certificate", "Completed application form"],
    documentsEs: ["DUI", "Partida de nacimiento", "Formulario de solicitud completo"],
    sourceUrl: "https://www.insaforp.org.sv", lastVerified: "2026-05-25",
    officeHours: "Monday–Friday, 8:00am–4:00pm",
    universalTip: "Check the INSAFORP website or visit in person to see the current course calendar. Courses fill up fast — register early.",
    // KB annotation audit: INSAFORP has been dissolved/restructured into INCAF —
    // agency name, URL, and process details below are stale pending content
    // rewrite (Spanish human review owed). Marked needs_review so grounding
    // hedges these facts instead of treating them as trusted/verified.
    reviewStatus: "needs_review",
  },

  // ── EL SALVADOR — SEPARATION / DIVORCE ────────────────
  {
    id: "sv-pgr-child-support",
    country: "SV", lifeEvents: ["separation"], employment: ["any"],
    name: "Child support claim (cuota alimenticia) — PGR",
    nameEs: "Fijación de cuota alimenticia — Procuraduría General",
    agency: "PGR", agencyFull: "Procuraduría General de la República",
    description: "File for court-ordered child support through the Attorney General's office. Free service — takes up to 55 business days. Works even if the other parent is abroad.",
    descriptionEs: "Solicitá una cuota alimenticia a través de la Procuraduría General. Servicio gratuito — hasta 55 días hábiles. Funciona aunque el otro padre esté en el exterior.",
    priority: 1, phaseToApply: 1,
    steps: [
      "Submit request to the PGR with details of the child and the other parent",
      "PGR forwards to Ministry of Diaspora if the defendant is abroad",
      "Defendant is formally cited through diplomatic/consular channels",
      "Hearing record is submitted back to the PGR",
      "PGR notifies you of the result",
      "Payments made by postal order or electronic transfer"
    ],
    documents: [
      "Your DUI and contact details",
      "Child's birth certificate or DUI",
      "Defendant's full name, location and phone number",
      "Requested monthly support amount (USD)",
      "Brief written explanation of the situation"
    ],
    documentsEs: [
      "Tu DUI y datos de contacto",
      "Partida de nacimiento del hijo/a o DUI",
      "Nombre completo, dirección y teléfono del demandado",
      "Monto mensual de alimentos solicitado (USD)",
      "Explicación breve de la situación"
    ],
    sourceUrl: "https://simple.sv/tramite/solicitud-de-fijacion-cuota-alimenticia/solicitud-de-fijacion-cuota-alimenticia",
    lastVerified: "2026-05-25",
    officeHours: "Monday–Friday (contact Family Unit: +503 2231-9484)",
    universalTip: "The PGR service is completely free. You do not need a lawyer. If the father/mother is in the US, they can be cited through the Salvadoran consulate in that city.",
    // KB annotation audit: unannotated, carries a "free" + 55-business-day
    // claim — added to the human-review worklist.
    reviewStatus: "needs_review",
  },
  {
    id: "sv-pgr-criminal-record",
    country: "SV", lifeEvents: ["separation", "job-loss", "diaspora", "any"], employment: ["any"],
    name: "Police background certificate (antecedentes policiales)",
    nameEs: "Constancia de antecedentes policiales — PNC",
    agency: "PNC", agencyFull: "Policía Nacional Civil",
    description: "Official certificate showing your criminal record (or absence of one). Required for employment, travel, emigration, and many legal procedures. Costs $3.50, ready in 5 business days.",
    descriptionEs: "Certificado oficial de tus antecedentes penales. Necesario para empleo, viaje, emigración y muchos trámites legales. Costo $3.50, listo en 5 días hábiles.",
    amount: "$3.50",
    deadline: "5 business days", deadlineDays: 5,
    priority: 2, phaseToApply: 1,
    steps: [
      "Go to simple.sv and search for 'antecedentes policiales'",
      "Authenticate with ClaveÚnica (your DUI number)",
      "Submit the online request",
      "Receive the certificate digitally within 5 business days"
    ],
    documents: ["Valid DUI (Documento Único de Identidad)"],
    documentsEs: ["DUI vigente (Documento Único de Identidad)"],
    sourceUrl: "https://simple.sv/tramite/constancia-de-antecedentes-policiales/nacionales",
    lastVerified: "2026-05-25",
    universalTip: "You can do this entirely online via simple.sv using your ClaveÚnica account. WhatsApp support: +503 7074-0253 (text only).",
    // KB annotation audit: unannotated, carries a $3.50 + 5-business-day
    // claim — added to the human-review worklist.
    reviewStatus: "needs_review",
  },

  // ── EL SALVADOR — SOCIAL BENEFITS ─────────────────────
  {
    id: "sv-fsv-housing-loan",
    country: "SV", lifeEvents: ["social-benefits", "housing", "property"], employment: ["formal"],
    name: "FSV housing loan (Fondo Social para la Vivienda)",
    nameEs: "Préstamo habitacional FSV",
    agency: "FSV", agencyFull: "Fondo Social para la Vivienda",
    description: "Check your FSV housing loan balance, payment history, and pay online. FSV offers low-interest housing loans to formal workers through employer deductions.",
    descriptionEs: "Consultá el saldo de tu préstamo FSV, historial de pagos y pagá en línea. El FSV ofrece préstamos habitacionales a trabajadores formales con descuento de planilla.",
    priority: 1, phaseToApply: 1,
    steps: [
      "Log in to simple.sv with your ClaveÚnica account",
      "Navigate to FSV loan consultation",
      "View balance, payment history (last 12 months or full history)",
      "Pay via credit or debit card"
    ],
    documents: ["Active FSV loan (must be an FSV borrower)", "ClaveÚnica account (DUI-based)"],
    documentsEs: ["Préstamo activo en el FSV", "Cuenta ClaveÚnica (basada en DUI)"],
    sourceUrl: "https://simple.sv/tramite/consulta-y-pago-de-prestamos-fsv/persona-natural",
    lastVerified: "2026-05-25",
    universalTip: "FSV loans are available to workers who contribute to the AFP/ISSS. Ask your employer about FSV affiliation if you're looking to buy or build a home.",
  },
]

export function lookupServices(params: {
  country: string
  lifeEvent: string
  employment: string
  // Slot-filling (Task S1): known decision-relevant facts for the current
  // situation, e.g. { businessSizeTier: "solo" }. Only used to suppress
  // services whose `suppressWhenSlot` matches — retrieval-side personalization,
  // never a change to grounding/plan-verify logic.
  slots?: Record<string, string>
}): Service[] {
  const results = services
    .filter(s =>
      s.country === params.country &&
      s.lifeEvents.includes(params.lifeEvent) &&
      (
        // "any"/"unknown" (citizen status not yet known) matches every service,
        // same as legacy behavior — precise formal-vs-informal gating applies
        // once employment is actually known.
        params.employment === "any" ||
        params.employment === "unknown" ||
        s.employment.includes(params.employment) ||
        s.employment.includes("any")
      ) &&
      !(
        s.suppressWhenSlot &&
        params.slots?.[s.suppressWhenSlot.key] !== undefined &&
        s.suppressWhenSlot.matches.includes(params.slots[s.suppressWhenSlot.key])
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

    // Deduplicate: same scheme can appear multiple times when scraped from
    // multiple sources (EN + ES version, agency site + aggregator, etc).
    // Keep the first occurrence per canonical key (agency + normalised name).
    const seen = new Set<string>()
    const unique = rows.filter((r) => {
      const name = (r.scheme_name as string ?? "").toLowerCase().trim()
      // Strip common suffixes that make EN/ES versions look different
      const base = name.replace(/\s*\(.*?\)\s*/g, "").trim()
      const key = `${r.agency}::${base}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Map Supabase row shape → Service shape
    return unique.map((r, i) => ({
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
      phaseToApply: Math.floor(i / 2) + 1,
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

// DEAD CODE — no callers anywhere in the app. Has 3 known correctness bugs, do
// NOT wire this in as-is: (1) the hardcoded 4-week cap silently drops services
// in a dependency chain deeper than 4 levels; (2) a dependsOn id that isn't in
// `svcs` blocks its dependent forever instead of being treated as satisfied;
// (3) a genuine cycle causes `break` and silently drops every stuck service.
// The corrected version of this batching idea lives in lib/plan-verify.ts's
// computeRanks(), which fixes all three and is what the plan route actually uses.
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
