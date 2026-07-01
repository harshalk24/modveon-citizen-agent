"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { Send } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import PreviewMessageRenderer from "../components/PreviewMessageRenderer"
import type { PreviewMessage, PreviewActivity, ChipOption } from "../types"

const MOCK = {
  name:     "Priya Kapoor",
  country:  "United Kingdom",
  city:     "London",
  business: "Bubble tea café",
}

let _id = 0
const uid   = (p = "n") => `${p}_${++_id}_${Date.now()}`
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

// UK food business steps shown as benefit-type cards
const STEPS = [
  {
    id:      "food-reg",
    name:    "Register food business with local council",
    desc:    "Mandatory for any business selling food. Free to register. Your council has up to 28 days to process it — this is the step with the longest lead time.",
    value:   "Free · ⚠️ 28-day processing",
    mode:    "online" as const,
    url:     "https://www.food.gov.uk/business-guidance/register-a-food-business",
    urgent:  true,
  },
  {
    id:      "companies-house",
    name:    "Register business at Companies House",
    desc:    "Set up as a sole trader (free, no registration needed) or limited company (£12 online, 24-hour approval). Most food businesses start as sole traders.",
    value:   "Free – £12",
    mode:    "online" as const,
    url:     "https://www.gov.uk/set-up-business",
    urgent:  false,
  },
  {
    id:      "hmrc",
    name:    "Register for Self Assessment with HMRC",
    desc:    "Required if you earn over £1,000/year from self-employment. Register by 5 October in your first year of trading.",
    value:   "Free",
    mode:    "online" as const,
    url:     "https://www.gov.uk/register-for-self-assessment",
    urgent:  false,
  },
  {
    id:      "hygiene",
    name:    "Level 2 Food Hygiene Certificate",
    desc:    "Legally required for anyone handling food. Online course, 2-3 hours, instant certificate. Valid for 3 years.",
    value:   "£25–30",
    mode:    "online" as const,
    url:     "https://www.highspeedtraining.co.uk/food-hygiene",
    urgent:  false,
  },
  {
    id:      "insurance",
    name:    "Public liability and employer insurance",
    desc:    "Public liability is legally required if customers visit your premises. Employer's liability is required if you hire any staff, even part-time.",
    value:   "£500–2,000/year",
    mode:    "online" as const,
    url:     "https://www.simplybusiness.co.uk",
    urgent:  false,
  },
]

export default function NavigationPage() {
  const router = useRouter()
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
  const updateAct  = (id: string, acts: PreviewActivity[]) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, activities: acts } : m))
  const markComplete = (id: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m))
  const withTyping = async (ms: number) => { setIsTyping(true); await delay(ms); setIsTyping(false) }
  const setGate  = (gate: string, chips: ChipOption[] = []) => {
    gateRef.current = gate; setWaitingForInput(gate); setCurrentChips(chips)
  }
  const clearGate = () => { gateRef.current = null; setWaitingForInput(null); setCurrentChips([]) }

  const addStep = (s: typeof STEPS[0]) => addMsg({
    id: uid("s"),
    type: "benefit" as any,
    docName:      s.name,
    content:      s.desc,
    urgent:       s.urgent,
    docMode:      s.mode,
    benefitValue: s.value,
    docApplyUrl:  s.url,
  } as PreviewMessage)

  /* ── Scan requirements ──────────────────────────────────── */
  async function runScan() {
    // No user message here — dispatcher adds it
    await delay(800)
    const actId = uid("act")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "a1", label: "Checking UK food business legal requirements…", status: "running" },
        { id: "a2", label: "Checking local council requirements for London…", status: "waiting" },
        { id: "a3", label: "Calculating timeline to opening date…",          status: "waiting" },
      ],
    })

    await delay(2000)
    updateAct(actId, [
      { id: "a1", label: "UK food business requirements listed ✓", status: "done",
        detail: "5 mandatory steps · 1 with 28-day lead time · FSA + Companies House + HMRC" },
      { id: "a2", label: "London council requirements added ✓",    status: "done",
        detail: "Food Standards Agency registration via gov.uk · no in-person visit needed" },
      { id: "a3", label: "TIMING ISSUE FOUND ⚠️",                  status: "done",
        detail: "Council food registration takes up to 28 days · you must register today to open next month" },
    ])
    markComplete(actId)

    await delay(800)
    await withTyping(2000)
    addMsg({
      id: uid(), type: "assistant",
      content: "To legally open your bubble tea café, you need **5 things done in the right order**. There's one that needs to happen **today**: the council food business registration takes up to 28 days to process — it's the longest step and most people leave it until last.",
    })
    await delay(400)

    for (const s of STEPS) { addStep(s); await delay(300) }

    await delay(500)
    await withTyping(1400)
    addMsg({
      id: uid(), type: "assistant",
      content: "The good news: four of the five are fully online and take less than a day. The council registration (Step 1) is the only one you need to do today.\n\nWant me to build your action plan with dates and deadlines?",
    })
    setGate("plan-gate", [
      { label: "Yes — build my action plan →",     value: "open-plan",  primary: true },
      { label: "Walk me through Step 1 first",     value: "step1"                     },
    ])
  }

  /* ── Step 1 detail ──────────────────────────────────────── */
  async function runStep1Detail() {
    await withTyping(1400)
    addMsg({
      id: uid(), type: "assistant",
      content: "To register your food business:\n\n1. Go to food.gov.uk/business-guidance/register-a-food-business\n2. Enter your business and premises details (5 minutes)\n3. The council contacts you within 28 days — usually much faster\n\nYou'll need: your business name, premises address, type of food you'll sell, and your name as the owner. That's it. No fee, no documents to upload.\n\nDo this today and you're clear to open in 28 days.",
    })
    setGate("plan-gate", [
      { label: "Build my full action plan →", value: "open-plan", primary: true },
    ])
  }

  /* ── Mount ──────────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => {
      if (scenarioStartedRef.current) return
      scenarioStartedRef.current = true
      addMsg({
        id: "intro", type: "assistant",
        content: `${greeting}, ${MOCK.name}! Tell me what you're planning and I'll map out every step you need — in the right order, with costs and timelines.`,
      })
      setGate("start", [
        { label: "I want to open a food business in London",  value: "food",   primary: true },
        { label: "What licences do I need for a café?",       value: "licences"              },
        { label: "I'm opening next month — what do I need?",  value: "urgent"                },
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
        food:     "I want to open a food business in London",
        licences: "What licences do I need for a café?",
        urgent:   "I'm opening next month — what do I need?",
      }
      addMsg({ id: uid("u0"), type: "user", content: labels[value] || value })
      await runScan()
      return
    }

    if (gate === "plan-gate") {
      if (value === "open-plan") {
        addMsg({ id: uid("u"), type: "user", content: "Yes — build my action plan →" })
        await withTyping(600)
        addMsg({ id: uid(), type: "assistant", content: "Opening your action plan now…" })
        await delay(600)
        router.push("/preview/plan")
      } else if (value === "step1") {
        addMsg({ id: uid("u"), type: "user", content: "Walk me through Step 1 first" })
        await runStep1Detail()
      }
      return
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-gray-900">{greeting}, {MOCK.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{MOCK.country} · Opening a {MOCK.business} · {MOCK.city}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Layer 2 · Guide</span>
          <PreviewNav current="navigation" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
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
          <div className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 select-none">Ask about your business setup…</div>
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center opacity-40"><Send size={14} className="text-gray-500" /></div>
        </div>
      </div>
    </div>
  )
}
