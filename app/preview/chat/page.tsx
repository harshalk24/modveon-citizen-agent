"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Send, MessageSquare } from "lucide-react"
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
  const [messages,        setMessages]        = useState<PreviewMessage[]>([])
  const [isTyping,        setIsTyping]        = useState(false)
  const [inputValue,      setInputValue]      = useState("")
  const [waitingForInput, setWaitingForInput] = useState<WaitingForInput>(null)
  const [currentChips,    setCurrentChips]    = useState<ChipOption[]>([])
  const [inputDisabled,   setInputDisabled]   = useState(true)
  const bottomRef          = useRef<HTMLDivElement>(null)
  // ref so async handlers always get the latest gate
  const gateRef            = useRef<WaitingForInput>(null)
  // guard against React StrictMode double-invoking the effect
  const scenarioStartedRef = useRef(false)
  // baby name captured mid-sequence
  const babyNameRef        = useRef("")

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
    if (gate === "baby-name") {
      setInputDisabled(false)
    }
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

  /* ── Phase A: Agent workflow (beats 3–8) ────────────────── */
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

    // Beat 4 — DUI retrieved
    await delay(2500)
    updateAct(actId, [
      { id: "a1", label: "DUI record fetched ✓", status: "done",
        detail: `registry.rnpn.gob.sv → ${MOCK.name} · DUI ${MOCK.dui} · ISSS active · employer: Retail Corp SA` },
      { id: "a2", label: "Checking RNPN birth registration rules…", status: "running",
        detail: "Querying rnpn.gob.sv rule set · checking 30-day birth window" },
      { id: "a3", label: "Searching for hospital discharge cert…",  status: "waiting" },
      { id: "a4", label: "Pre-filling RNPN registration form…",     status: "waiting" },
    ])
    addMsg({
      id: uid("docret"), type: "doc-retrieved",
      docName: "DUI Registry Data",
      docData: [
        { key: "Full name",    value: MOCK.name      },
        { key: "DUI number",   value: MOCK.dui       },
        { key: "Address",      value: MOCK.address   },
        { key: "ISSS status",  value: MOCK.isss      },
        { key: "Employer",     value: "Retail Corp SA" },
      ],
    })

    // Beat 5 — eligibility confirmed
    await delay(2200)
    updateAct(actId, [
      { id: "a1", label: "DUI record fetched ✓",              status: "done" },
      { id: "a2", label: "RNPN eligibility confirmed ✓",      status: "done",
        detail: `Baby born ${MOCK.babyDOB} · 3 days ago · within 30-day window ✓` },
      { id: "a3", label: "Searching for hospital discharge cert…", status: "running",
        detail: `Querying hospital-registry.salud.gob.sv for cert matching DUI ${MOCK.dui}` },
      { id: "a4", label: "Pre-filling RNPN registration form…",    status: "waiting" },
    ])

    // Beat 6 — hospital cert
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

    // Beat 7 — form pre-filled, 1 field missing
    await delay(1800)
    updateAct(actId, [
      { id: "a1", label: "DUI record fetched ✓",                      status: "done" },
      { id: "a2", label: "RNPN eligibility confirmed ✓",              status: "done" },
      { id: "a3", label: "Hospital cert found & verified ✓",          status: "done",
        detail: `cert ID ${MOCK.hospitalCert} · Hospital Nacional · matches DUI record` },
      { id: "a4", label: "Form pre-filled — 1 field still needed",    status: "done",
        detail: "4 of 5 fields auto-filled · baby name required (not on any registry)" },
    ])
    markComplete(actId)

    // Beat 8 — ask for baby name
    await delay(1000)
    await withTyping(1500)
    addMsg({
      id: uid("docreq"), type: "doc-request",
      docName: "Baby's full name",
      content: "I've retrieved everything from your records. Just one thing I can't find — **what's your baby's name?**",
    })

    setGate("baby-name")
  }

  /* ── Phase B: Show benefits first path ──────────────────── */
  async function runShowBenefits() {
    await delay(600)
    await withTyping(1800)
    addMsg({
      id: uid(), type: "assistant",
      content: "Based on your situation, here are **5 benefits** you qualify for:\n\n**1. RNPN birth registration** — ⚠️ 27 days left\n**2. Maternity benefit** — $400/month for 12 weeks\n**3. ISSS dependent enrollment** — within 1 year\n**4. Child subsidy** — $50/month\n**5. Paternity benefit (partner)** — 3 days paid leave\n\nTotal value: **$1,750/month**\n\nWant me to start with the most urgent — the RNPN registration?",
    })
    setGate("benefits-confirm", [
      { label: "Yes, handle RNPN", value: "yes-rnpn", primary: true },
      { label: "Not now",          value: "not-now" },
    ])
  }

  /* ── Phase C: Form preview ──────────────────────────────── */
  async function runFormPreview(babyName: string) {
    await delay(600)
    await withTyping(1200)
    addMsg({
      id: uid("form"), type: "form-preview",
      content: "The form is ready. Here's a preview — does everything look correct?",
      formFields: [
        { label: "Parent name",         value: MOCK.name,          status: "filled",   source: "DUI"           },
        { label: "DUI number",          value: MOCK.dui,           status: "filled",   source: "DUI"           },
        { label: "Baby's name",         value: babyName,           status: "filled",   source: "you"           },
        { label: "Date of birth",       value: MOCK.babyDOB,       status: "filled",   source: "hospital cert" },
        { label: "Hospital certificate",value: MOCK.hospitalCert,  status: "filled",   source: "hospital cert" },
        { label: "Father's DUI",        value: "",                 status: "optional", source: ""              },
      ],
      confirmOptions: [
        { label: "✓ Confirm and submit", value: "submit", primary: true },
        { label: "Make a change",        value: "edit" },
      ],
    })
    setGate("form-confirm")
  }

  /* ── Phase D: Submission flow ───────────────────────────── */
  async function runSubmission() {
    const subId = uid("sub")
    addMsg({
      id: subId, type: "activity", isComplete: false,
      activities: [
        { id: "s1", label: "Submitting to RNPN portal…",      status: "running"  },
        { id: "s2", label: "Awaiting confirmation number…",   status: "waiting"  },
        { id: "s3", label: "Setting up status reminder…",     status: "waiting"  },
      ],
    })

    await delay(2500)
    updateAct(subId, [
      { id: "s1", label: "Submitted to RNPN portal ✓",   status: "done"    },
      { id: "s2", label: "Confirmation received ✓",       status: "done",
        detail: "Reference: RNPN-2026-88341"                                },
      { id: "s3", label: "Reminder set — 5 days ✓",       status: "running" },
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

    // WhatsApp mock
    await delay(1500)
    addMsg({
      id: uid("wa"), type: "whatsapp-mock",
      whatsappText: `📱 Citizen Assist → ${MOCK.whatsapp}\n\n"María, your RNPN submission was received ✓ Reference: RNPN-2026-88341. I'll update you when it's processed (3–5 days)."`,
    })

    // Next step offer
    await delay(2000)
    await withTyping(2000)
    addMsg({
      id: uid("conf"), type: "confirmation",
      content: "That's 1 of 5 benefits handled. Your **next most urgent** step is enrolling your baby at ISSS for healthcare coverage — you have 1 year, but it's best done now while you have the RNPN certificate fresh.\n\nShall I start that process too?",
      confirmOptions: [
        { label: "Yes, start ISSS enrollment",   value: "isss",     primary: true },
        { label: "Show all my benefits first",   value: "benefits"               },
        { label: "That's enough for today",      value: "done"                   },
      ],
    })
    setGate("next-step")
  }

  /* ── Phase E: ISSS enrollment path ─────────────────────── */
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
        { id: "i1", label: "Retrieving RNPN certificate…",    status: "running" },
        { id: "i2", label: "Locating nearest ISSS office…",   status: "waiting" },
        { id: "i3", label: "Pre-filling enrollment form…",    status: "waiting" },
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

  /* ── Phase F: Done / summary ────────────────────────────── */
  async function runDone() {
    await delay(600)
    await withTyping(1200)
    addMsg({
      id: uid(), type: "assistant",
      content: "No problem, María. Here's where things stand:\n\n✅ RNPN registration — submitted\n⏳ ISSS enrollment — when you're ready\n⏳ Maternity benefit — when you're ready\n⏳ Child subsidy — auto after RNPN confirms\n⏳ Paternity benefit — your partner handles\n\nI'll message you on WhatsApp when RNPN is confirmed.",
    })
  }

  /* ── Phase G: Reminder ──────────────────────────────────── */
  async function runReminder() {
    await delay(600)
    await withTyping(1000)
    addMsg({
      id: uid("wa2"), type: "whatsapp-mock",
      whatsappText: `📱 Citizen Assist → ${MOCK.whatsapp}\n\n"Reminder for tomorrow: ISSS Soyapango visit for baby enrollment. Bring: DUI + RNPN certificate. Say: 'Vengo a inscribir a mi bebé como dependiente'. Hours: 7:30am–3:30pm."`,
    })
    await delay(1000)
    await withTyping(1200)
    addMsg({
      id: uid(), type: "assistant",
      content: "Done ✓ You'll get a WhatsApp reminder tomorrow morning.\n\n**Summary of today:**\n✅ RNPN registration submitted\n✅ ISSS visit prepared\n✅ Reminders set\n\nYou're all set, María.",
    })
  }

  /* ══════════════════════════════════════════════════════════
     ENTRY POINT — starts after page loads
     Phase 0: DUI identity verification (simulated login)
     Phase 1: Proactive benefits opening
     ══════════════════════════════════════════════════════════ */
  async function runScenario() {
    // ── DUI Login — simulated identity verification ──────────
    await delay(1500)
    await withTyping(1800)
    addMsg({
      id: uid("intro"), type: "assistant",
      content: "Good morning! 👋 To get started, I'll verify your identity through the **DUI registry** — this lets me access your records and pre-fill any forms automatically.",
    })

    await delay(1200)

    // Login activity card
    const loginId = uid("login")
    addMsg({
      id: loginId, type: "activity", isComplete: false,
      activities: [
        { id: "l1", label: "Connecting to DUI registry…",        status: "running" },
        { id: "l2", label: "Verifying identity…",                status: "waiting" },
        { id: "l3", label: "Loading your citizen profile…",      status: "waiting" },
        { id: "l4", label: "Checking active ISSS membership…",   status: "waiting" },
      ],
    })

    await delay(2200)
    updateAct(loginId, [
      { id: "l1", label: "DUI registry connected ✓",            status: "done",
        detail: "Secure TLS connection · registry.rnpn.gob.sv" },
      { id: "l2", label: "Identity verified ✓",                 status: "done",
        detail: `${MOCK.name} · DUI ${MOCK.dui} · confirmed match` },
      { id: "l3", label: "Loading your citizen profile…",       status: "running" },
      { id: "l4", label: "Checking active ISSS membership…",    status: "waiting" },
    ])

    await delay(1800)
    updateAct(loginId, [
      { id: "l1", label: "DUI registry connected ✓",             status: "done" },
      { id: "l2", label: "Identity verified ✓",                  status: "done" },
      { id: "l3", label: "Citizen profile loaded ✓",             status: "done",
        detail: `${MOCK.address} · language: es · country: SV` },
      { id: "l4", label: "ISSS membership confirmed ✓",          status: "done",
        detail: "Status: active contributor · employer: Retail Corp SA" },
    ])
    markComplete(loginId)

    // DUI data card
    await delay(1000)
    addMsg({
      id: uid("duicard"), type: "doc-retrieved",
      docName: "DUI Identity Verification",
      docData: [
        { key: "Full name",   value: MOCK.name    },
        { key: "DUI number",  value: MOCK.dui     },
        { key: "Address",     value: MOCK.address },
        { key: "ISSS status", value: MOCK.isss    },
        { key: "Employer",    value: "Retail Corp SA" },
      ],
    })

    // ── Proactive opening — agent spotted a deadline ─────────
    await delay(1500)
    await withTyping(2200)
    addMsg({
      id: uid("m1"), type: "assistant",
      content: "Good news — your identity is confirmed ✓\n\nI scanned your records and found something **urgent**: your baby was born 3 days ago and you have **27 days** left to complete the RNPN birth registration before a late fee kicks in.\n\nYou also qualify for **$1,750/month** in benefits you haven't claimed yet.\n\nWant me to handle the RNPN registration for you right now?",
    })
    setGate("initial", [
      { label: "Yes, do it for me",          value: "yes-apply",    primary: true },
      { label: "Show me what I qualify for", value: "show-benefits"               },
    ])
  }

  // Start on mount — scenarioStartedRef guards against React StrictMode double-invoke
  useEffect(() => {
    if (scenarioStartedRef.current) return
    scenarioStartedRef.current = true
    runScenario()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ══════════════════════════════════════════════════════════
     CHIP & INPUT DISPATCHERS
     ══════════════════════════════════════════════════════════ */
  async function handleChipAction(value: string) {
    const gate = gateRef.current
    clearGate()

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
        addMsg({ id: uid(), type: "assistant", content: "No problem. I'll be here whenever you're ready. Just say the word." })
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
        await runShowBenefits()
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
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-[calc(100vh-36px)]">

      {/* ── Left sidebar: mock citizen profile ──────────────── */}
      <aside className="w-[200px] min-h-full bg-[#1B3A8C] border-r border-[#152D70] flex-shrink-0 flex flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-yellow-400 flex items-center justify-center">
              <MessageSquare size={11} className="text-yellow-900" />
            </div>
            <span className="text-sm font-bold text-white">Citizen Assist</span>
          </div>
          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white mt-1">
            Preview mode
          </span>
        </div>

        <div className="px-4 py-4 flex-1">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Mock citizen</p>
          <p className="text-sm font-semibold text-white">{MOCK.name}</p>
          <p className="text-xs text-white/60 mt-0.5">{MOCK.country}</p>
          <div className="mt-3 space-y-1.5">
            {[
              { label: "Employment", value: MOCK.employment },
              { label: "Situation",  value: MOCK.lifeEvent  },
              { label: "DUI",        value: MOCK.dui        },
              { label: "ISSS",       value: MOCK.isss       },
            ].map(r => (
              <div key={r.label}>
                <p className="text-[10px] text-white/40 uppercase tracking-wide">{r.label}</p>
                <p className="text-xs text-white/80 font-medium">{r.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4">
          <Link href="/preview" className="text-xs text-white/40 hover:text-white/70 transition-colors">
            ← Exit preview
          </Link>
        </div>
      </aside>

      {/* ── Main chat area ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Citizen Assist</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Preview</span>
          </div>
          <Link href="/preview" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            ← Exit preview
          </Link>
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

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[85%]">
                <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Assist</p>
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

        {/* Chips / input gate area */}
        {waitingForInput && (
          <div className="bg-white border-t border-gray-100 px-4 py-2.5">
            {waitingForInput === "baby-name" ? (
              /* Text input gate */
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
              /* Chip gate */
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

        {/* Input bar — always visible, disabled during sequence */}
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 select-none">
              {inputDisabled
                ? "Citizen Assist is handling this step…"
                : "Type your message…"}
            </div>
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center opacity-40">
              <Send size={14} className="text-gray-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
