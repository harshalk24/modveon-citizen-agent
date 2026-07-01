"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { ArrowUp, CheckCircle2, Phone } from "lucide-react"
import BermudaLayout from "../../BermudaLayout"
import PreviewMessageRenderer from "../../../preview/components/PreviewMessageRenderer"
import type { PreviewMessage, PreviewActivity } from "../../../preview/types"

let _id = 0
const uid   = (p = "wp") => `${p}_${++_id}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const RED   = "#B23A2F"
const NAVY  = "#0F2A4A"

type Chip = { label: string; value: string; primary?: boolean }

function TimeDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3 px-1">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap px-2">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

function PRCCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3" style={{ backgroundColor: NAVY }}>
        <p className="text-xs font-semibold text-white">
          Permanent Resident's Certificate — Eligibility Summary
        </p>
      </div>
      <div className="px-4 py-4 space-y-3">
        {[
          ["Residence requirement", "20 continuous years of ordinary residence"],
          ["Your residency",        "19 years, 11 months (as of June 2026)"],
          ["Eligibility date",      "March 14, 2027"],
          ["Application fee",       "USD $10,000"],
          ["Authority",             "Dept. of Immigration · Section 31ZA"],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-3 text-xs">
            <span className="text-gray-400 flex-shrink-0 w-36">{k}</span>
            <span className="font-medium text-gray-900">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

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

export default function WorkPermitPage() {
  const [messages,        setMessages]        = useState<PreviewMessage[]>([])
  const [waitingForInput, setWaitingForInput] = useState<string | null>(null)
  const [currentChips,    setCurrentChips]    = useState<Chip[]>([])
  const bottomRef   = useRef<HTMLDivElement>(null)
  const msgCountRef = useRef(0)
  const gateRef     = useRef<string | null>(null)
  const startedRef  = useRef(false)

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
    await delay(2000)
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
    await addTypedMsg("Daniel — your work permit expires in 58 days.")
    await delay(700)
    await addTypedMsg("I've already run the checks. Ready to submit the renewal?")
    await delay(600)
    await showTypingThen("Submit it")
    await step2_process()
  }

  // ── Step 2 — Run all 6 tools then auto-proceed ───────────────────────────
  async function step2_process() {
    await addTypedMsg("Checks eligibility, confirms compliance, flags residency, pre-fills the form, attaches documents, submits.")
    await delay(600)

    const actId = uid("act1")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "w1", label: "Verified eligibility — Dept. of Immigration",  status: "running" },
        { id: "w2", label: "Confirmed promotion compliance",                 status: "waiting" },
        { id: "w3", label: "Cross-checked residency",                        status: "waiting" },
        { id: "w4", label: "Pre-filled renewal application",                 status: "waiting" },
        { id: "w5", label: "Attached supporting documents",                  status: "waiting" },
        { id: "w6", label: "Submitted to Dept. of Immigration",              status: "waiting" },
      ],
    })
    await delay(1700)
    updateAct(actId, [
      { id: "w1", label: "Eligibility verified — Standard Work Permit renewal", status: "done",
        detail: "58-day window open · renewal conditions met" },
      { id: "w2", label: "Confirmed promotion compliance", status: "running" },
      { id: "w3", label: "Cross-checked residency",        status: "waiting" },
      { id: "w4", label: "Pre-filled renewal application", status: "waiting" },
      { id: "w5", label: "Attached supporting documents",  status: "waiting" },
      { id: "w6", label: "Submitted to Dept. of Immigration", status: "waiting" },
    ])
    await delay(1900)
    updateAct(actId, [
      { id: "w1", label: "Eligibility verified — Standard Work Permit renewal",        status: "done" },
      { id: "w2", label: "Promotion compliance confirmed — internal advertising on file", status: "done",
        detail: "Internal posting confirmed for Mar 2026 promotion · compliant" },
      { id: "w3", label: "Cross-checked residency", status: "running" },
      { id: "w4", label: "Pre-filled renewal application", status: "waiting" },
      { id: "w5", label: "Attached supporting documents",  status: "waiting" },
      { id: "w6", label: "Submitted to Dept. of Immigration", status: "waiting" },
    ])
    await delay(1700)
    updateAct(actId, [
      { id: "w1", label: "Eligibility verified — Standard Work Permit renewal",        status: "done" },
      { id: "w2", label: "Promotion compliance confirmed — internal advertising on file", status: "done" },
      { id: "w3", label: "Residency cross-checked — 19 yrs 11 mo · PRC-track flagged 2027", status: "done",
        detail: "PRC eligibility: March 14, 2027 · flagged for preparation in February" },
      { id: "w4", label: "Pre-filled renewal application", status: "running" },
      { id: "w5", label: "Attached supporting documents",  status: "waiting" },
      { id: "w6", label: "Submitted to Dept. of Immigration", status: "waiting" },
    ])
    await delay(1500)
    updateAct(actId, [
      { id: "w1", label: "Eligibility verified — Standard Work Permit renewal",        status: "done" },
      { id: "w2", label: "Promotion compliance confirmed — internal advertising on file", status: "done" },
      { id: "w3", label: "Residency cross-checked — 19 yrs 11 mo · PRC-track flagged 2027", status: "done" },
      { id: "w4", label: "Renewal application pre-filled", status: "done",
        detail: "All fields auto-completed from Immigration records" },
      { id: "w5", label: "Attached supporting documents", status: "running" },
      { id: "w6", label: "Submitted to Dept. of Immigration", status: "waiting" },
    ])
    await delay(1500)
    updateAct(actId, [
      { id: "w1", label: "Eligibility verified — Standard Work Permit renewal",        status: "done" },
      { id: "w2", label: "Promotion compliance confirmed — internal advertising on file", status: "done" },
      { id: "w3", label: "Residency cross-checked — 19 yrs 11 mo · PRC-track flagged 2027", status: "done" },
      { id: "w4", label: "Renewal application pre-filled",                              status: "done" },
      { id: "w5", label: "Passport, employer letter, insurance confirmation attached",  status: "done",
        detail: "3 documents · all current as of April 2026" },
      { id: "w6", label: "Submitted to Dept. of Immigration", status: "running" },
    ])
    await delay(1800)
    updateAct(actId, [
      { id: "w1", label: "Eligibility verified — Standard Work Permit renewal",        status: "done" },
      { id: "w2", label: "Promotion compliance confirmed — internal advertising on file", status: "done" },
      { id: "w3", label: "Residency cross-checked — 19 yrs 11 mo · PRC-track flagged 2027", status: "done" },
      { id: "w4", label: "Renewal application pre-filled",                              status: "done" },
      { id: "w5", label: "Passport, employer letter, insurance confirmation attached",  status: "done" },
      { id: "w6", label: "Submitted to Dept. of Immigration",                          status: "done",
        detail: "Ref WP-2026-44712 · 18 Jun 2026 · estimated decision: 5–7 business days" },
    ])
    markComplete(actId)
    await delay(800)

    await addTypedMsg("✓ Renewal Submitted — Reference WP-2026-44712 · Estimated decision: 5–7 days (vs. up to 30 today)")

    await delay(1500)

    await addTypedMsg("Also — you're at 19 years, 11 months residency. PRC threshold is March 14, 2027, about 6 weeks after this renewal approves. I'll flag you in February with everything ready so you can apply the moment you're eligible.")
    await delay(500)
    addMsg({ id: uid("prc"), type: "prc-card" as any } as any)
    await delay(3500)
    addMsg({
      id: uid("wa"), type: "whatsapp-mock" as any,
      whatsappText: `📱 Citizen Agent → Daniel (+1 441 XXX-XXXX)\n\n"Work permit renewal submitted ✓\nRef: WP-2026-44712 · 18 Jun 2026\n\nEstimated decision: 5–7 business days.\n\nNext: PRC preparation reminder set for Feb 2027 — threshold: March 14, 2027."`,
    } as any)
    await delay(3000)
    await addTypedMsg("What used to take a trip to Hamilton and weeks of waiting just took seconds.")
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
  }

  return (
    <BermudaLayout
      activeTab="proactive"
      layerLabel="Layer 2 · Act"
      subtitle="Bermuda · Standard Work Permit · Passport ••••4521"
      userName="Daniel Chen"
      userInitials="DC"
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
              ) : (msg as any).type === "prc-card" ? (
                <PRCCard />
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
