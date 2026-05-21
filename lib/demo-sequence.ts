import type { AgentActivity } from "@/components/chat/AgentActivityCard"

export function startRNPNDemoSequence(
  citizenName: string,
  language: "en" | "es",
  onMessageAdd: (msg: any) => void,
  onActivityUpdate: (id: string, activities: AgentActivity[]) => void
) {
  const es = language === "es"
  const activityMsgId = `activity_${Date.now()}`

  // Step 1 — Activity card appears
  onMessageAdd({
    id: activityMsgId,
    role: "assistant",
    type: "activity",
    content: "",
    activities: [
      { id: "a1", label: es ? "Recuperando información del DUI..." : "Retrieving DUI information...", status: "running" },
      { id: "a2", label: es ? "Verificando elegibilidad RNPN..."  : "Checking RNPN eligibility...",  status: "waiting" },
      { id: "a3", label: es ? "Pre-llenando el formulario..."     : "Pre-filling the registration form...", status: "waiting" },
    ],
  })

  // Step 2 — DUI retrieved
  setTimeout(() => {
    onActivityUpdate(activityMsgId, [
      {
        id: "a1", status: "done",
        label: es ? "Información del DUI recuperada" : "DUI information retrieved",
        expandedContent: es
          ? `Nombre: ${citizenName || "María García"} · DUI: 12345678-9 · Empleada · ISSS activa`
          : `Name: ${citizenName || "María García"} · DUI: 12345678-9 · Employed · ISSS active`,
      },
      { id: "a2", label: es ? "Verificando elegibilidad RNPN..." : "Checking RNPN eligibility...", status: "running" },
      { id: "a3", label: es ? "Pre-llenando el formulario..."    : "Pre-filling the registration form...", status: "waiting" },
    ])

    onMessageAdd({
      id: `docret_${Date.now()}`,
      role: "assistant",
      type: "doc-retrieved",
      content: "",
      docRetrieved: {
        docName: es ? "Datos del DUI" : "DUI Data",
        source:  es ? "Registro DUI (demo)" : "DUI Registry (demo)",
        fields: [
          { key: es ? "Nombre completo" : "Full name",  value: citizenName || "María García" },
          { key: "DUI",                                  value: "12345678-9" },
          { key: es ? "Dirección" : "Address",          value: "Soyapango, San Salvador" },
          { key: es ? "Estado ISSS" : "ISSS status",    value: es ? "Activa" : "Active" },
        ],
        verified: true,
      },
    })
  }, 1200)

  // Step 3 — Eligibility confirmed
  setTimeout(() => {
    onActivityUpdate(activityMsgId, [
      { id: "a1", status: "done", label: es ? "Información del DUI recuperada" : "DUI information retrieved" },
      {
        id: "a2", status: "done",
        label: es ? "Elegibilidad RNPN confirmada" : "RNPN eligibility confirmed",
        expandedContent: es ? "Bebé nacido hace 3 días · Dentro del plazo de 30 días ✓" : "Baby born 3 days ago · Within 30-day window ✓",
      },
      { id: "a3", label: es ? "Pre-llenando el formulario..." : "Pre-filling the registration form...", status: "running" },
    ])
  }, 2500)

  // Step 4 — Form filled, ask for baby name
  setTimeout(() => {
    onActivityUpdate(activityMsgId, [
      { id: "a1", status: "done", label: es ? "Información del DUI recuperada" : "DUI information retrieved" },
      { id: "a2", status: "done", label: es ? "Elegibilidad RNPN confirmada"   : "RNPN eligibility confirmed" },
      {
        id: "a3", status: "done",
        label: es ? "Formulario pre-llenado" : "Form pre-filled",
        expandedContent: es ? "4 de 5 campos completados · Falta: nombre del bebé" : "4 of 5 fields filled · Missing: baby's name",
      },
    ])

    onMessageAdd({
      id: `docreq_${Date.now()}`,
      role: "assistant",
      type: "doc-request",
      content: "",
      docRequest: {
        docName: es ? "Nombre del bebé" : "Baby's name",
        docDescription: es
          ? "Necesito el nombre completo que le darás al bebé para completar el formulario."
          : "I need the full name you're giving your baby to complete the form.",
        options: [
          { label: es ? "✏️  Escribir el nombre" : "✏️  Enter the name", action: "type" },
          { label: es ? "Decidir después"         : "Decide later",       action: "skip" },
        ],
      },
    })
  }, 4000)
}

export function showFormPreview(
  babyName: string,
  citizenName: string,
  language: "en" | "es",
  onMessageAdd: (msg: any) => void
) {
  const es = language === "es"
  onMessageAdd({
    id: `form_${Date.now()}`,
    role: "assistant",
    type: "form-preview",
    content: "",
    formData: {
      title:       es ? "Registro de Nacimiento — RNPN" : "Birth Registration — RNPN",
      agency:      "RNPN",
      submitLabel: es ? "Confirmar y enviar" : "Confirm and submit",
      fields: [
        { label: es ? "Nombre del padre/madre" : "Parent name",         value: citizenName || "María García", status: "filled",   source: "DUI" },
        { label: "DUI",                                                   value: "12345678-9",                  status: "filled",   source: "DUI" },
        { label: es ? "Nombre del bebé" : "Baby's name",                value: babyName,                      status: "filled",   source: es ? "vos" : "you" },
        { label: es ? "Fecha de nacimiento" : "Date of birth",          value: new Date(Date.now() - 3 * 86400000).toLocaleDateString(es ? "es-SV" : "en-US"), status: "filled", source: es ? "estimada" : "estimated" },
        { label: es ? "Certificado del hospital" : "Hospital certificate", value: "HD-2026-44821",             status: "filled",   source: es ? "vos" : "you" },
        { label: es ? "DUI del padre (opcional)" : "Father's DUI (optional)", value: "",                      status: "optional", source: "" },
      ],
    },
  })
}

export function showSubmissionFlow(
  language: "en" | "es",
  onMessageAdd: (msg: any) => void
) {
  const es = language === "es"
  const submitId = `submit_${Date.now()}`

  onMessageAdd({
    id: submitId,
    role: "assistant",
    type: "activity",
    content: "",
    activities: [
      { id: "s1", label: es ? "Enviando al RNPN..." : "Submitting to RNPN...", status: "running" },
    ],
  })

  setTimeout(() => {
    onMessageAdd({
      id: `result_${Date.now()}`,
      role: "assistant",
      type: "status-update",
      content: es
        ? "✅ Enviado. Referencia: RNPN-2026-88341\n\nTiempo de procesamiento: 3–5 días hábiles. Te notificaré cuando esté listo."
        : "✅ Submitted. Reference: RNPN-2026-88341\n\nProcessing time: 3–5 business days. I'll notify you when it's confirmed.",
    })

    onMessageAdd({
      id: `conf_${Date.now()}`,
      role: "assistant",
      type: "confirmation",
      content: "",
      confirmationData: {
        question: es
          ? "¿Empezamos con la inscripción del bebé en el ISSS?"
          : "Shall I start the ISSS enrollment for your baby?",
        options: [
          { label: es ? "Sí, empezá" : "Yes, start it", value: "yes",   style: "primary" },
          { label: es ? "Más tarde"  : "Later",          value: "later", style: "secondary" },
        ],
      },
    })
  }, 2500)
}
