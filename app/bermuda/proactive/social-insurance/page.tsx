"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { ArrowUp, CheckCircle2, Phone } from "lucide-react"
import BermudaLayout from "../../BermudaLayout"
import PreviewMessageRenderer from "../../../preview/components/PreviewMessageRenderer"
import type { PreviewMessage, PreviewActivity } from "../../../preview/types"

let _id = 0
const uid   = (p = "si") => `${p}_${++_id}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const RED   = "#B23A2F"
const NAVY  = "#0F2A4A"

type Chip = { label: string; value: string; primary?: boolean }

// ── Time-skip divider ─────────────────────────────────────────────────────
function TimeDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3 px-1">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap px-2">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

// ── Forecast comparison card ───────────────────────────────────────────────
function ForecastCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-700">Pension Forecast — Age 65</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Department of Social Insurance · updated Jun 2026</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-100">
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-2">
            Current trajectory
          </p>
          <p className="text-2xl font-bold text-emerald-700">$2,840</p>
          <p className="text-xs text-gray-500 mt-0.5">/ month at retirement</p>
          <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
            Assumes contributions resume within 4 months
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-2">
            If lapse continues
          </p>
          <p className="text-2xl font-bold text-amber-700">$2,660</p>
          <p className="text-xs text-gray-500 mt-0.5">/ month at retirement</p>
          <p className="text-[10px] text-amber-500 mt-2 leading-relaxed">
            −$180/month · lapse period resets projection
          </p>
        </div>
      </div>
    </div>
  )
}

// ── WhatsApp card ─────────────────────────────────────────────────────────
function WhatsAppCard({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Agent</p>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-green-600 px-3 py-2 flex items-center gap-2">
            <Phone size={12} className="text-white" />
            <span className="text-xs font-semibold text-white">WhatsApp notification</span>
          </div>
          <div className="px-3 py-3">
            <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed font-mono bg-gray-50 rounded-lg p-2.5">
              {text}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Success card ────────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div className="flex justify-end">
      <div className="rounded-2xl rounded-tr-sm px-4 py-3" style={{ backgroundColor: RED }}>
        <div className="flex gap-1 items-center" style={{ height: 16 }}>
          {[0, 150, 300].map(d => (
            <div key={d} className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SuccessCard({ content }: { content: string }) {
  const text = content.replace(/^✓\s*/, "")
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Agent</p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800 leading-relaxed font-medium">{text}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function SocialInsurancePage() {
  const [messages,        setMessages]        = useState<PreviewMessage[]>([])
  const [waitingForInput, setWaitingForInput] = useState<string | null>(null)
  const [currentChips,    setCurrentChips]    = useState<Chip[]>([])
  const bottomRef  = useRef<HTMLDivElement>(null)
  const msgCountRef = useRef(0)
  const gateRef    = useRef<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (messages.length !== msgCountRef.current) {
      msgCountRef.current = messages.length
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const addMsg = (msg: PreviewMessage) => setMessages(prev => [...prev, msg])

  const updateAct = (id: string, acts: PreviewActivity[]) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, activities: acts } : m))

  const markComplete = (id: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m))

  const setGate = (gate: string, chips: Chip[] = []) => {
    gateRef.current = gate; setWaitingForInput(gate); setCurrentChips(chips)
  }
  const clearGate = () => { gateRef.current = null; setWaitingForInput(null); setCurrentChips([]) }

  async function showTypingThen(text: string) {
    const typingId = uid("typing")
    setMessages(prev => [...prev, { id: typingId, type: "typing" as any }])
    await delay(800 + Math.min(text.length * 12, 700))
    setMessages(prev => prev.filter(m => m.id !== typingId))
    await delay(80)
    addMsg({ id: uid("u"), type: "user", content: text })
  }

  async function addTypedMsg(text: string): Promise<string> {
    const id = uid()
    const type = text.startsWith("✓") ? "success" as any : "assistant"
    setMessages(prev => [...prev, { id, type, content: text }])
    return id
  }

  // ── Step 1 — Auto-open ────────────────────────────────────────────────────
  async function step1_open() {
    await delay(1200)
    await addTypedMsg(
      "Camille — your employer hasn't been contributing to your Social Insurance since March. I also found a voluntary contribution lapse. Two separate issues — both have fixes."
    )
    setGate("step1", [
      { label: "Walk me through it", value: "go-ahead", primary: true },
    ])
  }

  // ── Step 2 — Tool cards + short bubbles + forecast ────────────────────────
  async function step2_analysis() {
    addMsg({ id: uid("u"), type: "user", content: "Walk me through it" })

    const actId = uid("act1")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "s1", label: "Recalculating your contribution history",  status: "running" },
        { id: "s2", label: "Generating pension forecast",              status: "waiting" },
        { id: "s3", label: "Cross-checking employer registration",     status: "waiting" },
      ],
    })
    await delay(1600)
    updateAct(actId, [
      { id: "s1", label: "Contribution history recalculated", status: "done",
        detail: "14 months lapse on voluntary contributions · 4 months to forecast reset" },
      { id: "s2", label: "Generating pension forecast",           status: "running" },
      { id: "s3", label: "Cross-checking employer registration",  status: "waiting" },
    ])
    await delay(1700)
    updateAct(actId, [
      { id: "s1", label: "Contribution history recalculated", status: "done" },
      { id: "s2", label: "Pension forecast generated", status: "done",
        detail: "Current: $2,840/mo · If lapse continues: $2,660/mo at retirement" },
      { id: "s3", label: "Cross-checking employer registration", status: "running" },
    ])
    await delay(1900)
    updateAct(actId, [
      { id: "s1", label: "Contribution history recalculated", status: "done" },
      { id: "s2", label: "Pension forecast generated",        status: "done" },
      { id: "s3", label: "Employer registration gap found", status: "done",
        detail: "Employer contributions: $0 since March pay-grade change · payroll error or registration gap" },
    ])
    markComplete(actId)
    await delay(800)

    await addTypedMsg(
      "Two things. First: your voluntary contributions lapsed 14 months ago — 4 months left before your forecast resets, which is about $180/month less at retirement.\n\nSecond, bigger: your employer hasn't been contributing since your March promotion. $0 entries since then — likely a payroll or registration gap on their end, not yours."
    )
    await delay(500)
    addMsg({ id: uid("fc"), type: "forecast-card" as any } as any)
    await delay(700)

    await addTypedMsg("These need different fixes. Sorting both now.")
    await delay(400)
    await step3_lookInto()
  }

  // ── Step 3 — Parallel discovery ───────────────────────────────────────────
  async function step3_lookInto() {
    await delay(400)
    await addTypedMsg("Sorting both at once.")

    const actId = uid("act2")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "d1", label: "Track A — Scheduling recurring voluntary contribution",    status: "running" },
        { id: "d2", label: "Track B — Checking for existing cases with Social Insurance", status: "waiting" },
        { id: "d3", label: "Track B — Case search complete",                            status: "waiting" },
      ],
    })
    await delay(1500)
    updateAct(actId, [
      { id: "d1", label: "Track A — Voluntary contribution scheduled", status: "done",
        detail: "Resuming July 1, 2026 · monthly direct debit confirmed" },
      { id: "d2", label: "Track B — Checking for existing cases with Social Insurance", status: "running" },
      { id: "d3", label: "Track B — Case search complete",                               status: "waiting" },
    ])
    await delay(1500)
    updateAct(actId, [
      { id: "d1", label: "Track A — Voluntary contribution scheduled", status: "done" },
      { id: "d2", label: "Track B — Existing cases searched",          status: "done",
        detail: "Dept. of Social Insurance employer records · Apr–Jun 2026" },
      { id: "d3", label: "Track B — Case search complete",             status: "running" },
    ])
    await delay(1700)
    updateAct(actId, [
      { id: "d1", label: "Track A — Voluntary contribution scheduled", status: "done" },
      { id: "d2", label: "Track B — Existing cases searched",          status: "done" },
      { id: "d3", label: "Track B — Existing case found: SI-2026-0847", status: "done",
        detail: "Filed April 2026, same employer · no follow-up on record" },
    ])
    markComplete(actId)
    await delay(800)

    await addTypedMsg(
      "Voluntary contributions are sorted — resuming July 1.\n\nThe employer gap, though: there's already an open case. Social Insurance flagged this same issue in April, case #SI-2026-0847. Nobody followed up. I don't need to file anything new — I can attach your contribution history to the existing case instead, which should resolve faster than starting over."
    )
    setGate("step3", [
      { label: "Attach my records to the existing case", value: "attach-records", primary: true },
    ])
  }

  // ── Step 4 — Attach records ───────────────────────────────────────────────
  async function step4_attach() {
    addMsg({ id: uid("u"), type: "user", content: "Attach my records to the existing case" })

    const actId = uid("act3")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "a1", label: "Attaching contribution history to case SI-2026-0847", status: "running" },
        { id: "a2", label: "Case updated",                                          status: "waiting" },
      ],
    })
    await delay(1800)
    updateAct(actId, [
      { id: "a1", label: "Contribution history attached", status: "done",
        detail: "Mar–Jun 2026 records · 4 pay periods · case SI-2026-0847" },
      { id: "a2", label: "Case updated", status: "running" },
    ])
    await delay(1400)
    updateAct(actId, [
      { id: "a1", label: "Contribution history attached", status: "done" },
      { id: "a2", label: "Case SI-2026-0847 updated", status: "done",
        detail: "Response required within 10 business days · ref logged 18 Jun 2026" },
    ])
    markComplete(actId)
    await delay(700)

    await addTypedMsg("Records attached. They're required to respond within 10 business days. I'd hold off mentioning this to HR until we hear back — cleaner paper trail if it turns out to be more than a clerical error.")

    // Auto-advance to time skip
    await delay(2200)
    addMsg({ id: uid("ts"), type: "time-skip" as any, label: "4 days later" } as any)
    await delay(900)

    // Step 5 — Unexpected good news (auto, no gate)
    await addTypedMsg(
      "Camille — Social Insurance responded faster than expected. The employer gap was a registration error on their end — backdated and fixed. Your contributions for March through June have been credited in full. Pension forecast is back to where it should be, no loss at all."
    )
    await delay(700)
    addMsg({
      id: uid("wa"), type: "whatsapp-mock" as any,
      whatsappText: `📱 Citizen Agent → Camille (+1 441 XXX-XXXX)\n\n"Case SI-2026-0847 resolved ✓\n\nEmployer contribution gap (Mar–Jun 2026):\nRegistration error — backdated & credited in full.\n\nPension forecast at 65: $2,840/mo ✓\nVoluntary contributions: resuming Jul 1, 2026\n\nNo further action needed on your end."`,
    } as any)
    await delay(600)

    await delay(600)
    await addTypedMsg("Two issues, both closed — without Camille having to make a single call or visit an office.")
  }

  // ── Mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (startedRef.current) return
      startedRef.current = true
      void step1_open()
    }, 80)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dispatcher ──────────────────────────────────────────────────────────
  async function handleChipAction(value: string) {
    const gate = gateRef.current
    clearGate()

    if (gate === "step1" && value === "go-ahead")        { await step2_analysis(); return }
    if (gate === "step3" && value === "attach-records")  { await step4_attach();   return }
  }

  return (
    <BermudaLayout
      activeTab="proactive"
      layerLabel="Layer 2 · Act"
      subtitle="Bermuda · Standard Work Permit · Passport ••••4521"
      userName="Camille Outerbridge"
      userInitials="CO"
      userRole="Social Insurance"
    >
      <div className="flex flex-col h-full" style={{ backgroundColor: "#F5F3EE" }}>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          {messages.map(msg => (
            <Fragment key={msg.id}>
              {(msg as any).type === "typing" ? (
                <TypingBubble />
              ) : (msg as any).type === "time-skip" ? (
                <TimeDivider label={(msg as any).label} />
              ) : (msg as any).type === "forecast-card" ? (
                <ForecastCard />
              ) : (msg as any).type === "whatsapp-mock" ? (
                <WhatsAppCard text={(msg as any).whatsappText} />
              ) : (msg as any).type === "success" ? (
                <SuccessCard content={msg.content!} />
              ) : msg.type === "user" ? (
                <div className="flex justify-end">
                  <div
                    className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm font-medium text-white"
                    style={{ backgroundColor: RED }}
                  >
                    {msg.content}
                  </div>
                </div>
              ) : (
                <PreviewMessageRenderer message={msg} onAction={handleChipAction} />
              )}
            </Fragment>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Chip gate */}
        {waitingForInput && (
          <div className="ca-chips-wrapper bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
            <div className="ca-chips-inner flex flex-wrap gap-2">
              {currentChips.map(chip => (
                <button
                  key={chip.value}
                  onClick={() => handleChipAction(chip.value)}
                  className="ca-suggestion-chip px-4 py-1.5 text-xs font-semibold rounded-full transition-colors"
                  style={
                    chip.primary
                      ? { backgroundColor: RED, color: "white" }
                      : { border: "1px solid #D1D5DB", background: "white", color: "#374151" }
                  }
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 select-none">
              Ask about Bermuda government services…
            </div>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 opacity-50"
              style={{ backgroundColor: RED }}
            >
              <ArrowUp size={14} className="text-white" />
            </div>
          </div>
        </div>
      </div>
    </BermudaLayout>
  )
}
