"use client"

import { useState, useEffect, useRef } from "react"
import { Send } from "lucide-react"
import { useLang } from "@/contexts/LanguageContext"
import PreviewMessageRenderer from "../components/PreviewMessageRenderer"
import type {
  PreviewMessage, PreviewActivity,
  WaitingForInput, ChipOption,
} from "../types"

/* ── Mock citizen data ──────────────────────────────────────── */
const MOCK = {
  name: "María García",
  country: "El Salvador",
  employment: "Employed",
  lifeEvent: "New baby",
  dui: "12345678-9",
  isss: "Active contributor",
  address: "Soyapango, San Salvador",
  babyDOB: "May 15, 2026",
  hospitalCert: "HD-2026-44821",
  whatsapp: "+503 7XXX-XXXX",
}

/* ── Helpers ────────────────────────────────────────────────── */
let _msgId = 0
const uid = (prefix = "m") => `${prefix}_${++_msgId}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export default function PreviewChatPage() {
  const { lang } = useLang()
  const langRef  = useRef(lang)
  useEffect(() => { langRef.current = lang }, [lang])

  const [messages,        setMessages]        = useState<PreviewMessage[]>([])
  const [isTyping,        setIsTyping]        = useState(false)
  const [inputValue,      setInputValue]      = useState("")
  const [waitingForInput, setWaitingForInput] = useState<WaitingForInput>(null)
  const [currentChips,    setCurrentChips]    = useState<ChipOption[]>([])
  const [inputDisabled,   setInputDisabled]   = useState(true)
  const bottomRef          = useRef<HTMLDivElement>(null)
  const gateRef            = useRef<WaitingForInput>(null)
  const scenarioStartedRef = useRef(false)
  const babyNameRef        = useRef("")

  const hour = new Date().getHours()
  const greeting = lang === "es"
    ? (hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches")
    : (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening")

  /* ── Auto-scroll ────────────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  /* ── State helpers ──────────────────────────────────────── */
  const addMsg = (msg: PreviewMessage) =>
    setMessages(prev => [...prev, msg])

  const updateAct = (id: string, acts: PreviewActivity[]) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, activities: acts } : m))

  const markComplete = (id: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m))

  const withTyping = async (ms: number) => {
    setIsTyping(true)
    await delay(ms)
    setIsTyping(false)
  }

  const setGate = (gate: WaitingForInput, chips: ChipOption[] = []) => {
    gateRef.current = gate
    setWaitingForInput(gate)
    setCurrentChips(chips)
    if (gate === "baby-name") setInputDisabled(false)
  }

  const clearGate = () => {
    gateRef.current = null
    setWaitingForInput(null)
    setCurrentChips([])
    setInputDisabled(true)
  }

  /* ══════════════════════════════════════════════════════════
     SCENARIO PHASES
     ══════════════════════════════════════════════════════════ */

  async function runAgentWorkflow() {
    const actId = uid("act")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "a1", label: "Fetching your DUI record from registry…",  status: "running" },
        { id: "a2", label: "Checking RNPN birth registration rules…",  status: "waiting" },
        { id: "a3", label: "Searching for hospital discharge cert…",   status: "waiting" },
        { id: "a4", label: "Pre-filling RNPN registration form…",      status: "waiting" },
      ],
    })
    await delay(2500)
    updateAct(actId, [
      { id: "a1", label: "DUI record fetched ✓", status: "done",
        detail: `registry.rnpn.gob.sv → ${MOCK.name} · DUI ${MOCK.dui} · ISSS active` },
      { id: "a2", label: "Checking RNPN birth registration rules…", status: "running",
        detail: "Querying rnpn.gob.sv rule set · checking 30-day birth window" },
      { id: "a3", label: "Searching for hospital discharge cert…",  status: "waiting" },
      { id: "a4", label: "Pre-filling RNPN registration form…",     status: "waiting" },
    ])
    addMsg({
      id: uid("docret"), type: "doc-retrieved",
      docName: "DUI Registry Data",
      docData: [
        { key: "Full name",   value: MOCK.name    },
        { key: "DUI number",  value: MOCK.dui     },
        { key: "Address",     value: MOCK.address },
        { key: "ISSS status", value: MOCK.isss    },
        { key: "Employer",    value: "Retail Corp SA" },
      ],
    })
    await delay(2200)
    updateAct(actId, [
      { id: "a1", label: "DUI record fetched ✓",              status: "done" },
      { id: "a2", label: "RNPN eligibility confirmed ✓",      status: "done",
        detail: `Baby born ${MOCK.babyDOB} · 3 days ago · within 30-day window ✓` },
      { id: "a3", label: "Searching for hospital discharge cert…", status: "running",
        detail: `Querying hospital-registry.salud.gob.sv for cert matching DUI ${MOCK.dui}` },
      { id: "a4", label: "Pre-filling RNPN registration form…", status: "waiting" },
    ])
    await delay(2000)
    addMsg({
      id: uid("docret2"), type: "doc-retrieved",
      docName: "Hospital Discharge Certificate",
      docData: [
        { key: "Certificate ID", value: MOCK.hospitalCert },
        { key: "Hospital",       value: "Hospital Nacional" },
        { key: "Date of birth",  value: MOCK.babyDOB },
        { key: "Status",         value: "Verified ✓" },
      ],
    })
    await delay(1800)
    updateAct(actId, [
      { id: "a1", label: "DUI record fetched ✓",                    status: "done" },
      { id: "a2", label: "RNPN eligibility confirmed ✓",            status: "done" },
      { id: "a3", label: "Hospital cert found & verified ✓",        status: "done",
        detail: `cert ID ${MOCK.hospitalCert} · Hospital Nacional · matches DUI record` },
      { id: "a4", label: "Form pre-filled — 1 field still needed",  status: "done",
        detail: "4 of 5 fields auto-filled · baby name required (not on any registry)" },
    ])
    markComplete(actId)
    await delay(1000)
    await withTyping(1500)
    addMsg({
      id: uid("docreq"), type: "doc-request",
      docName: "Baby's full name",
      content: "I've retrieved everything from your records. Just one thing I can't find — **what's your baby's name?**",
    })
    setGate("baby-name")
  }

  async function runShowBenefits() {
    await delay(600)
    await withTyping(1800)
    addMsg({
      id: uid(), type: "assistant",
      content: `${langRef.current === "es" ? `Basándome en tu situación, encontré **5 beneficios** para los que calificás — total: **$1,750/mes**. El más urgente tiene un plazo de 27 días:` : `Based on your situation, I found **5 benefits** you qualify for — total value: **$1,750/month**. The most urgent has a 27-day deadline:`}`,
    })
    await delay(300)
    // Benefit cards with apply links
    const es = langRef.current === "es"
    const benefitCards = [
      { docName: es ? "Registro de nacimiento — RNPN" : "Birth registration — RNPN", docApplyUrl: "https://www.rnpn.gob.sv", docMode: "in-person", docData: [
        { key: es ? "Valor" : "Value",        value: es ? "Obligatorio" : "Required" },
        { key: es ? "Plazo" : "Deadline",     value: es ? "⚠️ 27 días desde el nacimiento" : "⚠️ 27 days from birth" },
        { key: es ? "Dónde" : "Where",        value: "RNPN · rnpn.gob.sv" },
      ]},
      { docName: es ? "Prestación por maternidad — ISSS" : "Maternity benefit — ISSS", docApplyUrl: "https://www.isss.gob.sv", docMode: "in-person", docData: [
        { key: es ? "Valor" : "Value",        value: es ? "$400/mes por 12 semanas" : "$400/month for 12 weeks" },
        { key: es ? "Quién califica" : "Who", value: es ? "Trabajadoras con 36 semanas cotizadas" : "Formal workers with 36 weeks contributions" },
        { key: es ? "Dónde" : "Where",        value: "ISSS · isss.gob.sv" },
      ]},
      { docName: es ? "Inscripción de bebé en ISSS" : "Baby ISSS enrollment", docApplyUrl: "https://www.isss.gob.sv", docMode: "in-person", docData: [
        { key: es ? "Valor" : "Value",        value: es ? "Cobertura médica del bebé" : "Baby healthcare coverage" },
        { key: es ? "Plazo" : "Deadline",     value: es ? "Dentro de 1 año del nacimiento" : "Within 1 year of birth" },
        { key: es ? "Requiere" : "Requires",  value: es ? "Partida de nacimiento del RNPN primero" : "RNPN birth cert first" },
      ]},
      { docName: es ? "Subsidio por hijo" : "Child subsidy", docApplyUrl: "https://www.presidencia.gob.sv", docMode: "online", docData: [
        { key: es ? "Valor" : "Value",        value: "$50/mes" },
        { key: es ? "Cómo" : "How",           value: es ? "Automático después del RNPN" : "Auto-processed after RNPN registration" },
      ]},
      { docName: es ? "Licencia de paternidad" : "Paternity benefit", docApplyUrl: "https://www.isss.gob.sv", docMode: "in-person", docData: [
        { key: es ? "Valor" : "Value",        value: es ? "3 días pagos" : "3 paid days" },
        { key: es ? "Quién" : "Who",          value: es ? "El patrono lo tramita" : "Employer files on father's behalf" },
      ]},
    ]
    for (const b of benefitCards) {
      addMsg({ id: uid("ben"), type: "doc-retrieved", docName: b.docName, docData: b.docData, ...({ docApplyUrl: b.docApplyUrl, docMode: b.docMode } as any) })
      await delay(250)
    }
    await delay(400)
    await withTyping(1000)
    addMsg({
      id: uid(), type: "assistant",
      content: es ? "¿Querés que tramite el registro del RNPN ahora mismo? Es el más urgente." : "Want me to handle the RNPN registration right now? It's the most time-sensitive.",
    })
    setGate("benefits-confirm", [
      { label: es ? "Sí, hacelo" : "Yes, handle RNPN", value: "yes-rnpn", primary: true },
      { label: es ? "Ahora no" : "Not now",             value: "not-now" },
    ])
  }

  async function runFormPreview(babyName: string) {
    await delay(600)
    await withTyping(1200)
    addMsg({
      id: uid("form"), type: "form-preview",
      ...({ formTitle: "Birth Registration — RNPN", formAgency: "RNPN" } as any),
      content: "The form is ready. Here's a preview — does everything look correct?",
      formFields: [
        { label: "Parent name",          value: MOCK.name,         status: "filled",   source: "DUI"           },
        { label: "DUI number",           value: MOCK.dui,          status: "filled",   source: "DUI"           },
        { label: "Baby's name",          value: babyName,          status: "filled",   source: "you"           },
        { label: "Date of birth",        value: MOCK.babyDOB,      status: "filled",   source: "hospital cert" },
        { label: "Hospital certificate", value: MOCK.hospitalCert, status: "filled",   source: "hospital cert" },
        { label: "Father's DUI",         value: "",                status: "optional", source: ""              },
      ],
      confirmOptions: [
        { label: "✓ Confirm and submit", value: "submit", primary: true },
        { label: "Make a change",        value: "edit" },
      ],
    })
    setGate("form-confirm")
  }

  async function runSubmission() {
    const subId = uid("sub")
    addMsg({
      id: subId, type: "activity", isComplete: false,
      activities: [
        { id: "s1", label: "Submitting to RNPN portal…",    status: "running" },
        { id: "s2", label: "Awaiting confirmation number…", status: "waiting" },
        { id: "s3", label: "Setting up status reminder…",   status: "waiting" },
      ],
    })
    await delay(2500)
    updateAct(subId, [
      { id: "s1", label: "Submitted to RNPN portal ✓", status: "done"    },
      { id: "s2", label: "Confirmation received ✓",    status: "done",
        detail: "Reference: RNPN-2026-88341"                              },
      { id: "s3", label: "Reminder set — 5 days ✓",   status: "running" },
    ])
    await delay(1500)
    updateAct(subId, [
      { id: "s1", label: "Submitted ✓",              status: "done" },
      { id: "s2", label: "Confirmed ✓",              status: "done" },
      { id: "s3", label: "Status check scheduled ✓", status: "done" },
    ])
    markComplete(subId)
    await delay(1000)
    await withTyping(1800)
    addMsg({
      id: uid("status"), type: "status",
      content: "**Submitted ✓** Reference: RNPN-2026-88341\n\nI'll check the status in 5 days and let you know on WhatsApp when it's confirmed.",
    })
    await delay(1500)
    addMsg({
      id: uid("wa"), type: "whatsapp-mock",
      whatsappText: `📱 Citizen Agent → ${MOCK.whatsapp}\n\n"María, your RNPN submission was received ✓ Reference: RNPN-2026-88341. I'll update you when it's processed (3–5 days)."`,
    })
    await delay(2000)
    await withTyping(2000)
    addMsg({
      id: uid("conf"), type: "confirmation",
      content: "That's 1 of 5 benefits handled. Your **next most urgent** step is enrolling your baby at ISSS for healthcare coverage — you have 1 year, but it's best done now while you have the RNPN certificate fresh.\n\nShall I start that process too?",
      confirmOptions: [
        { label: "Yes, start ISSS enrollment", value: "isss",     primary: true },
        { label: "Show all my benefits first", value: "benefits"               },
        { label: "That's enough for today",    value: "done"                   },
      ],
    })
    setGate("next-step")
  }

  async function runISSS() {
    await delay(600)
    await withTyping(1500)
    addMsg({
      id: uid(), type: "assistant",
      content: "Starting ISSS dependent enrollment for your baby...\n\nI'll need the RNPN birth certificate we just obtained. Give me a moment.",
    })
    const isssId = uid("isss")
    await delay(1000)
    addMsg({
      id: isssId, type: "activity", isComplete: false,
      activities: [
        { id: "i1", label: "Retrieving RNPN certificate…",  status: "running" },
        { id: "i2", label: "Locating nearest ISSS office…", status: "waiting" },
        { id: "i3", label: "Pre-filling enrollment form…",  status: "waiting" },
      ],
    })
    await delay(2500)
    updateAct(isssId, [
      { id: "i1", label: "RNPN certificate retrieved ✓", status: "done",
        detail: "Reference RNPN-2026-88341 · Issued today" },
      { id: "i2", label: "Nearest ISSS office found ✓",  status: "done",
        detail: "ISSS Soyapango · 2.3km away · Open Mon–Fri 7:30am" },
      { id: "i3", label: "Enrollment form ready ✓",      status: "done" },
    ])
    markComplete(isssId)
    await delay(1000)
    await withTyping(1800)
    addMsg({
      id: uid(), type: "assistant",
      content: "The ISSS enrollment form is ready. This one requires an **in-person visit** — I can't submit it on your behalf.\n\nBut I've prepared everything:\n\n**Where to go:** ISSS Soyapango, Bulevar del Ejército\n**Hours:** Mon–Fri 7:30am–3:30pm\n**What to say:** 'Vengo a inscribir a mi bebé como dependiente'\n**Bring:** Your DUI · RNPN certificate · Baby's name\n\nWant me to set a reminder for your visit?",
    })
    addMsg({
      id: uid("conf2"), type: "confirmation",
      confirmOptions: [
        { label: "Set reminder for tomorrow", value: "reminder", primary: true },
        { label: "I'll handle it",            value: "done-isss" },
      ],
    })
    setGate("next-step")
  }

  async function runDone() {
    await delay(600)
    await withTyping(1200)
    addMsg({
      id: uid(), type: "assistant",
      content: "No problem, María. Here's where things stand:\n\n✅ RNPN registration — submitted\n⏳ ISSS enrollment — when you're ready\n⏳ Maternity benefit — when you're ready\n⏳ Child subsidy — auto after RNPN confirms\n⏳ Paternity benefit — your partner handles\n\nI'll message you on WhatsApp when RNPN is confirmed.",
    })
  }

  async function runReminder() {
    await delay(600)
    await withTyping(1000)
    addMsg({
      id: uid("wa2"), type: "whatsapp-mock",
      whatsappText: `📱 Citizen Agent → ${MOCK.whatsapp}\n\n"Reminder for tomorrow: ISSS Soyapango visit for baby enrollment. Bring: DUI + RNPN certificate. Say: 'Vengo a inscribir a mi bebé como dependiente'. Hours: 7:30am–3:30pm."`,
    })
    await delay(1000)
    await withTyping(1200)
    addMsg({
      id: uid(), type: "assistant",
      content: "Done ✓ You'll get a WhatsApp reminder tomorrow morning.\n\n**Summary of today:**\n✅ RNPN registration submitted\n✅ ISSS visit prepared\n✅ Reminders set\n\nYou're all set, María.",
    })
  }

  /* ══════════════════════════════════════════════════════════
     SCENARIO — identity already verified at login, skip re-check
     ══════════════════════════════════════════════════════════ */
  async function runScenario() {
    await delay(600)
    await withTyping(1800)
    const es = langRef.current === "es"
    addMsg({
      id: uid("m1"), type: "assistant",
      content: es
        ? "Encontré algo **urgente** en tus registros: tu bebé nació hace 3 días y tienes **27 días** para completar el registro de nacimiento en el RNPN antes de que aplique una multa por mora.\n\nTambién calificás para **$1,750/mes** en beneficios que aún no has reclamado.\n\n¿Querés que tramite el registro del RNPN ahora mismo?"
        : "I found something **urgent** in your records: your baby was born 3 days ago and you have **27 days** left to complete the RNPN birth registration before a late fee kicks in.\n\nYou also qualify for **$1,750/month** in benefits you haven't claimed yet.\n\nWant me to handle the RNPN registration for you right now?",
    })
    setGate("initial", es
      ? [
          { label: "Sí, hacelo por mí",        value: "yes-apply",    primary: true },
          { label: "Mostrarme mis beneficios",  value: "show-benefits"               },
        ]
      : [
          { label: "Yes, do it for me",          value: "yes-apply",    primary: true },
          { label: "Show me what I qualify for", value: "show-benefits"               },
        ]
    )
  }

  /* ── Mount: show greeting + Start chip ─────────────────── */
  /* Guard is INSIDE the timeout so StrictMode cleanup/re-run still fires it once */
  useEffect(() => {
    const t = setTimeout(() => {
      if (scenarioStartedRef.current) return
      scenarioStartedRef.current = true
      const es = langRef.current === "es"
      const h   = new Date().getHours()
      const g   = es
        ? (h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches")
        : (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening")
      addMsg({
        id: "intro",
        type: "assistant",
        content: es
          ? `${g}, María! 👋 Tu identidad ha sido verificada ✓\n\nHe cargado tus registros y estoy listo para ayudarte a reclamar tus beneficios.`
          : `${g}, María! 👋 Your identity has been verified ✓\n\nI've loaded your records and I'm ready to help you claim your benefits.`,
      })
      setGate("start", [
        { label: lang === "es" ? "¿Qué tengo que hacer?" : "What do I need to do?",     value: "start", primary: true },
        { label: lang === "es" ? "Mostrarme mis beneficios" : "Show me my benefits",     value: "start" },
      ])
    }, 80)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = () => {
    clearGate()
    addMsg({ id: uid("u0"), type: "user", content: "Start" })
    setTimeout(() => runScenario(), 400)
  }

  /* ── Chip & input dispatchers ───────────────────────────── */
  async function handleChipAction(value: string) {
    const gate = gateRef.current
    clearGate()

    if (gate === "start") {
      addMsg({ id: uid("u0"), type: "user", content: value === "start" ? (lang === "es" ? "¿Qué tengo que hacer?" : "What do I need to do?") : (lang === "es" ? "Mostrarme mis beneficios" : "Show me my benefits") })
      setTimeout(() => runScenario(), 400)
      return
    }
    if (gate === "initial") {
      if (value === "yes-apply") {
        addMsg({ id: uid("u1"), type: "user", content: "Yes, do it for me" })
        await runAgentWorkflow()
      }
      if (value === "show-benefits") {
        addMsg({ id: uid("u1b"), type: "user", content: "Show me what I qualify for" })
        await runShowBenefits()
      }
      return
    }
    if (gate === "benefits-confirm") {
      if (value === "yes-rnpn") {
        addMsg({ id: uid("u"), type: "user", content: "Yes, handle RNPN" })
        await runAgentWorkflow()
      }
      if (value === "not-now") {
        addMsg({ id: uid("u"), type: "user", content: "Not now" })
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "No problem. I'll be here whenever you're ready." })
      }
      return
    }
    if (gate === "form-confirm") {
      if (value === "submit") {
        addMsg({ id: uid("u3"), type: "user", content: "Confirm and submit" })
        await runSubmission()
      }
      if (value === "edit") {
        addMsg({ id: uid("u"), type: "user", content: "Make a change" })
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "No problem — type the correction you'd like to make and I'll update the form." })
      }
      return
    }
    if (gate === "next-step") {
      if (value === "isss") {
        addMsg({ id: uid("u4"), type: "user", content: "Yes, start ISSS enrollment" })
        await runISSS()
      }
      if (value === "benefits") {
        addMsg({ id: uid("u"), type: "user", content: "Show all my benefits first" })
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "Here's your full benefit summary:\n\n✅ **RNPN registration** — submitted ✓\n⏳ **Maternity benefit** — $400/mo for 12 weeks · isss.gob.sv\n⏳ **Baby ISSS enrollment** — within 1 year · isss.gob.sv\n⏳ **Child subsidy** — $50/mo · auto after RNPN confirms\n⏳ **Paternity benefit** — 3 days paid leave · partner's employer" })
      }
      if (value === "done") {
        addMsg({ id: uid("u5"), type: "user", content: "That's enough for today" })
        await runDone()
      }
      if (value === "reminder") {
        addMsg({ id: uid("u6"), type: "user", content: "Set reminder for tomorrow" })
        await runReminder()
      }
      if (value === "done-isss") {
        addMsg({ id: uid("u"), type: "user", content: "I'll handle it" })
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "Sounds good. I'll follow up on WhatsApp once your RNPN is confirmed." })
      }
      return
    }
  }

  function handleBabyNameSubmit() {
    const name = inputValue.trim()
    if (!name || gateRef.current !== "baby-name") return
    babyNameRef.current = name
    setInputValue("")
    clearGate()
    setInputDisabled(true)
    runFormPreview(name)
  }

  /* ══════════════════════════════════════════════════════════
     RENDER — no custom sidebars; main Sidebar handles nav
     ══════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-screen">

      {/* Header: name + greeting + citizen context */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {greeting}, {MOCK.name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {MOCK.country} · {lang === "es" ? "Bebé nuevo" : MOCK.lifeEvent} · {lang === "es" ? "Empleada" : MOCK.employment} · DUI {MOCK.dui}
          </p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
          Preview
        </span>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{
          backgroundColor: "#F9FAFB",
          backgroundImage: "radial-gradient(circle, rgba(255,196,0,0.15) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {messages.map(msg => (
          <PreviewMessageRenderer
            key={msg.id}
            message={msg}
            onAction={handleChipAction}
          />
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="max-w-[85%]">
              <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Agent</p>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Chip / input gate */}
      {waitingForInput && (
        <div className="bg-white border-t border-gray-100 px-4 py-2.5 flex-shrink-0">
            {waitingForInput === "baby-name" ? (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleBabyNameSubmit() }}
                placeholder="Enter your baby's full name…"
                className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-50 bg-white"
              />
              <button
                onClick={handleBabyNameSubmit}
                disabled={!inputValue.trim()}
                className="w-9 h-9 rounded-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 flex items-center justify-center disabled:opacity-40 transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {currentChips.map(chip => (
                <button
                  key={chip.value}
                  onClick={() => handleChipAction(chip.value)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors
                    ${chip.primary
                      ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-500"
                      : "border border-gray-300 bg-white text-gray-600 hover:border-yellow-400 hover:bg-yellow-50"
                    }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input bar */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 select-none">
            {inputDisabled ? "Citizen Agent is handling this step…" : "Type your message…"}
          </div>
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center opacity-40">
            <Send size={14} className="text-gray-500" />
          </div>
        </div>
      </div>
    </div>
  )
}
