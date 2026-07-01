"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { ArrowUp, CheckCircle2, Phone } from "lucide-react"
import BermudaLayout from "../../BermudaLayout"
import PreviewMessageRenderer from "../../../preview/components/PreviewMessageRenderer"
import type { PreviewMessage, PreviewActivity } from "../../../preview/types"

let _id = 0
const uid   = (p = "nb") => `${p}_${++_id}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const RED   = "#B23A2F"

type Chip = { label: string; value: string; primary?: boolean }

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

export default function NewbornRegistrationPage() {
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

  async function addTypedMsg(text: string): Promise<string> {
    const id = uid()
    const type = text.startsWith("✓") ? "success" as any : "assistant"
    setMessages(prev => [...prev, { id, type, content: text }])
    return id
  }

  async function showTypingThen(text: string) {
    const typingId = uid("typing")
    setMessages(prev => [...prev, { id: typingId, type: "typing" as any }])
    await delay(2000)
    setMessages(prev => prev.filter(m => m.id !== typingId))
    await delay(80)
    addMsg({ id: uid("u"), type: "user", content: text })
  }

  // ── Step 1 — Auto-open ────────────────────────────────────────────────────
  async function step1_open() {
    await delay(1200)
    await addTypedMsg("Sarah — your baby was born 3 days ago.")
    await delay(900)
    await addTypedMsg("I can register the birth and set up health coverage right now.")
    await delay(62000)
    await showTypingThen("Yes please")
    await step2_retrieve()
  }

  // ── Step 2 — Retrieve records, ask name, submit ──────────────────────────
  async function step2_retrieve() {

    const actId = uid("act1")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "n1", label: "Retrieving Social Insurance record",        status: "running" },
        { id: "n2", label: "Retrieving hospital discharge certificate", status: "waiting" },
        { id: "n3", label: "Checking employer health plan",             status: "waiting" },
        { id: "n4", label: "Pre-filling birth registration form",       status: "waiting" },
      ],
    })
    await delay(1600)
    updateAct(actId, [
      { id: "n1", label: "Social Insurance record confirmed — active", status: "done",
        detail: "SIN verified · contribution status: current" },
      { id: "n2", label: "Retrieving hospital discharge certificate", status: "running" },
      { id: "n3", label: "Checking employer health plan",             status: "waiting" },
      { id: "n4", label: "Pre-filling birth registration form",       status: "waiting" },
    ])
    await delay(1700)
    updateAct(actId, [
      { id: "n1", label: "Social Insurance record confirmed — active",    status: "done" },
      { id: "n2", label: "Hospital discharge certificate — KEMH, verified", status: "done",
        detail: "Discharge date: 15 Jun 2026 · attending physician confirmed" },
      { id: "n3", label: "Checking employer health plan", status: "running" },
      { id: "n4", label: "Pre-filling birth registration form", status: "waiting" },
    ])
    await delay(1500)
    updateAct(actId, [
      { id: "n1", label: "Social Insurance record confirmed — active",      status: "done" },
      { id: "n2", label: "Hospital discharge certificate — KEMH, verified", status: "done" },
      { id: "n3", label: "Employer HIP plan confirmed", status: "done",
        detail: "Group Health Insurance · coverage back-dated to birth date" },
      { id: "n4", label: "Pre-filling birth registration form", status: "running" },
    ])
    await delay(1600)
    updateAct(actId, [
      { id: "n1", label: "Social Insurance record confirmed — active",      status: "done" },
      { id: "n2", label: "Hospital discharge certificate — KEMH, verified", status: "done" },
      { id: "n3", label: "Employer HIP plan confirmed",                      status: "done" },
      { id: "n4", label: "Birth registration pre-filled — 4 of 5 fields complete", status: "done",
        detail: "Missing: baby's name — not on any registry" },
    ])
    markComplete(actId)
    await delay(800)

    await addTypedMsg("Got everything from your records — one thing I can't pull automatically. What's her name?")

    await delay(1800)
    await showTypingThen("Emily")

    await delay(400)
    await addTypedMsg("Submitting Emily's birth registration now.")

    const subId = uid("sub")
    addMsg({
      id: subId, type: "activity", isComplete: false,
      activities: [
        { id: "s1", label: "Submitting to Registry General",    status: "running" },
        { id: "s2", label: "Awaiting reference number",         status: "waiting" },
      ],
    })
    await delay(2000)
    updateAct(subId, [
      { id: "s1", label: "Submitted to Registry General", status: "done" },
      { id: "s2", label: "Reference received — BMD-REG-2026-30417", status: "done",
        detail: "18 Jun 2026 · birth certificate ready in 5 business days" },
    ])
    markComplete(subId)
    await delay(700)

    await addTypedMsg("Birth registration submitted. Ref BMD-REG-2026-30417 — certificate ready in 5 business days.")
    await delay(500)

    addMsg({
      id: uid("wa"), type: "whatsapp-mock" as any,
      whatsappText: `📱 Citizen Agent → Sarah (+1 441 XXX-XXXX)\n\n"Birth registration submitted ✓\nRef: BMD-REG-2026-30417\n\nCertificate ready: approx 5 business days.\nEnrolling with health plan now."`,
    } as any)
    await delay(1000)

    await addTypedMsg("Now enrolling with your employer's health plan...")

    const hipId = uid("hip")
    addMsg({
      id: hipId, type: "activity", isComplete: false,
      activities: [
        { id: "h1", label: "Submitting health insurance enrollment", status: "running" },
        { id: "h2", label: "Confirming coverage start date",         status: "waiting" },
      ],
    })
    await delay(1800)
    updateAct(hipId, [
      { id: "h1", label: "Health insurance enrollment submitted", status: "done" },
      { id: "h2", label: "Coverage active from 15 Jun 2026",      status: "done",
        detail: "Enrollment ref HI-2026-18741 · Group HIP plan · KEMH" },
    ])
    markComplete(hipId)
    await delay(700)

    await addTypedMsg("✓ Birth Registered · Coverage Active — 2 deadlines met, 0 trips made · Ref BMD-REG-2026-30417")
    await delay(600)
    await addTypedMsg("Two government processes that used to mean two separate office visits — done before she's left hospital.")
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
  async function handleChipAction(_value: string) {
    clearGate()
  }

  return (
    <BermudaLayout
      activeTab="proactive"
      layerLabel="Layer 2 · Act"
      subtitle="Bermuda · Resident · Passport ••••3892"
      userName="Sarah Williams"
      userInitials="SW"
    >
      <div className="flex flex-col h-full" style={{ backgroundColor: "#F5F3EE" }}>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          {messages.map(msg => (
            <Fragment key={msg.id}>
              {(msg as any).type === "typing" ? (
                <TypingBubble />
              ) : (msg as any).type === "success" ? (
                <SuccessCard content={msg.content!} />
              ) : (msg as any).type === "whatsapp-mock" ? (
                <WhatsAppCard text={(msg as any).whatsappText} />
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
