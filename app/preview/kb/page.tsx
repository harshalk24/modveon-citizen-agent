"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { Send } from "lucide-react"
import Link from "next/link"
import PreviewMessageRenderer from "../components/PreviewMessageRenderer"
import type { PreviewMessage, ChipOption } from "../types"

const MOCK = {
  name:     "James Miller",
  country:  "United States",
  status:   "Retired",
  age:      "67",
  ssn:      "•••-••-7832",
  medicare: "Part A + Part B enrolled",
  state:    "Ohio",
  income:   "$1,840/month (SSA benefit)",
  whatsapp: "+1 (614) 555-0147",
}

let _id = 0
const uid   = (p = "k") => `${p}_${++_id}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function PreviewNav({ current }: { current: "kb" | "navigation" | "pagent" }) {
  const links = [
    { label: "KB",         href: "/preview/kb",         key: "kb"         },
    { label: "Navigation", href: "/preview/navigation",  key: "navigation" },
    { label: "Proactive",  href: "/preview/pagent",      key: "pagent"     },
  ]
  return (
    <div className="flex items-center gap-1 ml-2">
      {links.map(l => (
        <Link key={l.key} href={l.href}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
            current === l.key ? "bg-yellow-400 text-yellow-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          {l.label}
        </Link>
      ))}
    </div>
  )
}

// Benefit data — each card rendered as type "benefit" in the message flow
const BENEFITS = [
  {
    id: "extra-help",
    name: "Medicare Extra Help (LIS)",
    description: "Cuts your Part D drug costs by up to 80%. At your income level you'd qualify for the full subsidy — premium drops from $42 to $0.",
    value: "$2,400/year",
    mode: "online" as const,
    url:  "https://www.ssa.gov/extrahelp",
    urgent: true,
    detail: "Apply online at ssa.gov/extrahelp. Takes ~10 minutes. Have your Medicare card and bank balance total ready.\n\n**Deadline:** Open Enrollment closes in ~60 days. Miss it and you wait a full year.",
  },
  {
    id: "snap",
    name: "SNAP Food Assistance",
    description: "Monthly EBT card for groceries. Fixed-income retirees on SSA commonly qualify.",
    value: "$1,200/year",
    mode: "in-person" as const,
    url:  "https://benefits.ohio.gov",
    urgent: false,
    detail: "Apply at your county Job and Family Services office or online at benefits.ohio.gov.\n\n**No deadline** — apply any time.",
  },
  {
    id: "heap",
    name: "Ohio HEAP Energy Assistance",
    description: "Reduces heating and cooling bills. Applied directly to your utility account.",
    value: "$800/year",
    mode: "in-person" as const,
    url:  "https://energyhelp.ohio.gov",
    urgent: true,
    detail: "Apply at your local Community Action Agency or at energyhelp.ohio.gov.\n\n**Deadline:** Before November 1st each year.",
  },
  {
    id: "homestead",
    name: "Ohio Homestead Exemption",
    description: "Reduces the taxable value of your home by $25,000. One-time application, permanent benefit.",
    value: "$400+/year",
    mode: "in-person" as const,
    url:  "https://www.ohio.gov/government/local-government/county-auditors",
    urgent: false,
    detail: "File with your county auditor's office. Bring driver's licence, proof of age, and most recent tax bill.\n\n**Deadline:** File by June 1st.",
  },
]

export default function KBPage() {
  const [messages,        setMessages]        = useState<PreviewMessage[]>([])
  const [isTyping,        setIsTyping]        = useState(false)
  const [waitingForInput, setWaitingForInput] = useState<string | null>(null)
  const [currentChips,    setCurrentChips]    = useState<ChipOption[]>([])
  const bottomRef          = useRef<HTMLDivElement>(null)
  const gateRef            = useRef<string | null>(null)
  const scenarioStartedRef = useRef(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, isTyping])

  const addMsg     = (msg: PreviewMessage) => setMessages(prev => [...prev, msg])
  const withTyping = async (ms: number) => { setIsTyping(true); await delay(ms); setIsTyping(false) }
  const setGate  = (gate: string, chips: ChipOption[] = []) => {
    gateRef.current = gate; setWaitingForInput(gate); setCurrentChips(chips)
  }
  const clearGate = () => { gateRef.current = null; setWaitingForInput(null); setCurrentChips([]) }

  /* helper: emit a single benefit card as a "benefit" type message */
  const addBenefit = (b: typeof BENEFITS[0]) => addMsg({
    id: uid("b"),
    type: "benefit" as any,
    docName: b.name,
    content: b.description,
    urgent: (b as any).urgent,
    docMode: (b as any).mode,
    benefitValue: (b as any).value,
    docApplyUrl: b.url,
  } as PreviewMessage)

  /* ── Show all 4 benefits inline ──────────────────────────── */
  async function runShowAllBenefits() {
    await withTyping(1200)
    // No greeting — conversation already started. Just answer the question.
    addMsg({
      id: uid(), type: "assistant",
      content: `Based on your profile — retired, age ${MOCK.age}, Ohio, income ${MOCK.income} — I found **${BENEFITS.length} programmes** you qualify for. Here they are, with how to apply for each:`,
    })
    for (const b of BENEFITS) {
      await delay(300)
      addBenefit(b)
    }
    await delay(500)
    await withTyping(1000)
    addMsg({
      id: uid(), type: "assistant",
      content: "Three of those four programmes — most retirees have never heard of them. They exist, you qualify, and nobody told you. The most time-sensitive is Medicare Extra Help — want me to walk you through applying?",
    })
    setGate("after-all", [
      { label: "Yes, walk me through Medicare Extra Help", value: "medicare", primary: true },
      { label: "Send this plan to my WhatsApp",            value: "whatsapp" },
    ])
  }

  /* ── Show only one benefit ───────────────────────────────── */
  async function runSingleBenefit(id: string) {
    const b = BENEFITS.find(x => x.id === id)
    if (!b) return
    await withTyping(1000)
    addMsg({
      id: uid(), type: "assistant",
      content: `Sure — here's everything you need to know about **${b.name}**:`,
    })
    await delay(200)
    addBenefit(b)
    await delay(400)
    await withTyping(1200)
    addMsg({ id: uid(), type: "assistant", content: b.detail })
    setGate("after-single", [
      { label: "Show me all my benefits",                   value: "all" },
      { label: "Send this to my WhatsApp",                  value: "whatsapp" },
    ])
  }

  /* ── Medicare Extra Help deep dive ──────────────────────── */
  async function runMedicareDetail() {
    const b = BENEFITS[0]
    await withTyping(1400)
    addMsg({
      id: uid(), type: "assistant",
      content: "Medicare Extra Help can save you around **$200/month** on prescriptions.\n\nYour current Part D plan (SilverScript Choice) costs $42/month. With Extra Help at your income level, that drops to **$0**. Copays fall by up to 80%.",
    })
    await delay(300)
    addBenefit(b)
    await delay(400)
    await withTyping(1000)
    addMsg({
      id: uid(), type: "assistant",
      content: "It takes about 10 minutes online at ssa.gov/extrahelp. You'll need:\n- Your Medicare card\n- Your bank balance total (checking + savings)\n\nOpen Enrollment closes in ~60 days. After that you'd wait a full year.",
    })
    setGate("medicare-cta", [
      { label: "Open ssa.gov/extrahelp", value: "open",    primary: true },
      { label: "Remind me in 3 days",    value: "remind" },
    ])
  }

  /* ── WhatsApp plan ───────────────────────────────────────── */
  async function runWhatsApp() {
    await delay(400)
    addMsg({
      id: uid("wa"), type: "whatsapp-mock",
      whatsappText: `📱 Citizen Agent → James (${MOCK.whatsapp})\n\nYour benefit summary — $4,800+/year:\n\n1) Medicare Extra Help — $2,400/yr ⚠️ Online · ssa.gov/extrahelp · Apply in 60 days\n2) SNAP Food Assistance — $1,200/yr · In-person · benefits.ohio.gov\n3) Ohio HEAP Energy — $800/yr ⚠️ In-person · energyhelp.ohio.gov · Before Nov 1\n4) Ohio Homestead Exemption — $400+/yr · In-person · County auditor · Before Jun 1\n\nReply "start" when you're ready to apply for any of these.`,
    })
    await delay(600)
    await withTyping(900)
    addMsg({ id: uid(), type: "assistant", content: "Sent ✓ I'll remind you before each deadline, James." })
  }

  /* ── Mount ──────────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => {
      if (scenarioStartedRef.current) return
      scenarioStartedRef.current = true
      addMsg({
        id: "intro", type: "assistant",
        content: `${greeting}, ${MOCK.name}! I'm Citizen Agent — I find every government programme you qualify for and show you exactly how to claim them.\n\nWhat would you like to know?`,
      })
      setGate("start", [
        { label: "What benefits do I qualify for?",   value: "all",      primary: true },
        { label: "Tell me about Medicare Extra Help", value: "medicare"              },
        { label: "Show me Ohio-specific programmes",  value: "ohio"                  },
      ])
    }, 80)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Dispatcher ─────────────────────────────────────────── */
  async function handleChipAction(value: string) {
    const gate = gateRef.current
    clearGate()

    if (gate === "start") {
      const labels: Record<string, string> = {
        all:      "What benefits do I qualify for?",
        medicare: "Tell me about Medicare Extra Help",
        ohio:     "Show me Ohio-specific programmes",
      }
      addMsg({ id: uid("u"), type: "user", content: labels[value] || value })
      if (value === "medicare")      await runMedicareDetail()
      else if (value === "ohio")     await runSingleBenefit("heap")
      else                           await runShowAllBenefits()
      return
    }

    if (gate === "after-all" || gate === "after-single") {
      const labels: Record<string, string> = {
        medicare: "Yes, walk me through Medicare Extra Help",
        whatsapp: "Send this plan to my WhatsApp",
        all:      "Show me all my benefits",
      }
      addMsg({ id: uid("u"), type: "user", content: labels[value] || value })
      if (value === "medicare")  await runMedicareDetail()
      else if (value === "all")  await runShowAllBenefits()
      else if (value === "whatsapp") await runWhatsApp()
      return
    }

    if (gate === "medicare-cta") {
      const labels: Record<string, string> = { open: "Open ssa.gov/extrahelp", remind: "Remind me in 3 days" }
      addMsg({ id: uid("u"), type: "user", content: labels[value] || value })
      if (value === "open") {
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "Opening ssa.gov/extrahelp in a new tab. Have your Medicare card and bank balance total ready — it takes about 10 minutes. Good luck, James! 🎉" })
      } else {
        addMsg({ id: uid("wa2"), type: "whatsapp-mock",
          whatsappText: `📱 Citizen Agent → James\n\n"Reminder: Medicare Extra Help — ssa.gov/extrahelp · 10 min · Have Medicare card + bank balance. Window closes in ~60 days."` })
        await delay(400)
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "Done — I'll ping you in 3 days. $2,400 a year is worth 10 minutes. 👍" })
      }
      return
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-gray-900">{greeting}, {MOCK.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{MOCK.country} · {MOCK.status} · Age {MOCK.age} · SSN {MOCK.ssn}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Layer 1 · Know</span>
          <PreviewNav current="kb" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ backgroundColor: "#F9FAFB", backgroundImage: "radial-gradient(circle, rgba(255,196,0,0.15) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        {messages.map(msg => (
          <Fragment key={msg.id}>
            {(msg as any).type === "separator" ? (
              <div className="flex items-center gap-3 my-1 px-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{msg.content}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            ) : (
              <PreviewMessageRenderer message={msg} onAction={handleChipAction} />
            )}
          </Fragment>
        ))}
        {isTyping && (
          <div className="flex justify-start"><div className="max-w-[85%]">
            <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Agent</p>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div></div>
        )}
        <div ref={bottomRef} />
      </div>

      {waitingForInput && (
        <div className="bg-white border-t border-gray-100 px-4 py-2.5 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {currentChips.map(chip => (
              <button key={chip.value} onClick={() => handleChipAction(chip.value)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${chip.primary ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-500" : "border border-gray-300 bg-white text-gray-600 hover:border-yellow-400 hover:bg-yellow-50"}`}>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 select-none">Ask about any benefit…</div>
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center opacity-40"><Send size={14} className="text-gray-500" /></div>
        </div>
      </div>
    </div>
  )
}
