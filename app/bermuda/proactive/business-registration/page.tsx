"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { ArrowUp, CheckCircle2 } from "lucide-react"
import BermudaLayout from "../../BermudaLayout"
import PreviewMessageRenderer from "../../../preview/components/PreviewMessageRenderer"
import type { PreviewMessage, PreviewActivity } from "../../../preview/types"

let _id = 0
const uid   = (p = "br") => `${p}_${++_id}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const RED   = "#B23A2F"

type Chip = { label: string; value: string; primary?: boolean }

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

export default function BusinessRegistrationPage() {
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
    await addTypedMsg("Kezia — ready to register Bermuda Coastal Catering? I can set this up properly right now.")
    await delay(600)
    await showTypingThen("Set it up")
    await step2_process()
  }

  // ── Step 2 — Run all 6 tools ──────────────────────────────────────────────
  async function step2_process() {

    const actId = uid("act1")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "b1", label: "Checking growth plan",                                      status: "running" },
        { id: "b2", label: "Comparing business structures",                             status: "waiting" },
        { id: "b3", label: "Checking grant eligibility",                                status: "waiting" },
        { id: "b4", label: "Submitting grant application",                              status: "waiting" },
        { id: "b5", label: "Incorporating company",                                     status: "waiting" },
        { id: "b6", label: "Registering with Tax Commissioner and Social Insurance",    status: "waiting" },
      ],
    })
    await delay(1700)
    updateAct(actId, [
      { id: "b1", label: "Growth plan checked — hiring within 6 months confirmed", status: "done",
        detail: "Triggers employer registration requirements from day one" },
      { id: "b2", label: "Comparing business structures", status: "running" },
      { id: "b3", label: "Checking grant eligibility",    status: "waiting" },
      { id: "b4", label: "Submitting grant application",  status: "waiting" },
      { id: "b5", label: "Incorporating company",         status: "waiting" },
      { id: "b6", label: "Registering with Tax Commissioner and Social Insurance", status: "waiting" },
    ])
    await delay(1900)
    updateAct(actId, [
      { id: "b1", label: "Growth plan checked — hiring within 6 months confirmed", status: "done" },
      { id: "b2", label: "Structure compared — incorporated recommended", status: "done",
        detail: "Lower effective tax rate vs. sole proprietorship once staff are added" },
      { id: "b3", label: "Checking grant eligibility", status: "running" },
      { id: "b4", label: "Submitting grant application", status: "waiting" },
      { id: "b5", label: "Incorporating company",        status: "waiting" },
      { id: "b6", label: "Registering with Tax Commissioner and Social Insurance", status: "waiting" },
    ])
    await delay(1800)
    updateAct(actId, [
      { id: "b1", label: "Growth plan checked — hiring within 6 months confirmed", status: "done" },
      { id: "b2", label: "Structure compared — incorporated recommended", status: "done" },
      { id: "b3", label: "Grant eligibility confirmed — must apply before incorporating", status: "done",
        detail: "Dept. of Economic Development · SME grant · window closes at incorporation" },
      { id: "b4", label: "Submitting grant application", status: "running" },
      { id: "b5", label: "Incorporating company",        status: "waiting" },
      { id: "b6", label: "Registering with Tax Commissioner and Social Insurance", status: "waiting" },
    ])
    await delay(2000)
    updateAct(actId, [
      { id: "b1", label: "Growth plan checked — hiring within 6 months confirmed", status: "done" },
      { id: "b2", label: "Structure compared — incorporated recommended", status: "done" },
      { id: "b3", label: "Grant eligibility confirmed — must apply before incorporating", status: "done" },
      { id: "b4", label: "Grant application submitted — Dept. of Economic Development", status: "done",
        detail: "Application ref EDA-2026-0814 · 18 Jun 2026 · response within 15 business days" },
      { id: "b5", label: "Incorporating company", status: "running" },
      { id: "b6", label: "Registering with Tax Commissioner and Social Insurance", status: "waiting" },
    ])
    await delay(1700)
    updateAct(actId, [
      { id: "b1", label: "Growth plan checked — hiring within 6 months confirmed", status: "done" },
      { id: "b2", label: "Structure compared — incorporated recommended", status: "done" },
      { id: "b3", label: "Grant eligibility confirmed — must apply before incorporating", status: "done" },
      { id: "b4", label: "Grant application submitted — Dept. of Economic Development", status: "done" },
      { id: "b5", label: "Incorporated under the lower-tax structure", status: "done",
        detail: "Reg. #BC-2026-3317 · Registrar of Companies · 18 Jun 2026" },
      { id: "b6", label: "Registering with Tax Commissioner and Social Insurance", status: "running" },
    ])
    await delay(1800)
    updateAct(actId, [
      { id: "b1", label: "Growth plan checked — hiring within 6 months confirmed", status: "done" },
      { id: "b2", label: "Structure compared — incorporated recommended", status: "done" },
      { id: "b3", label: "Grant eligibility confirmed — must apply before incorporating", status: "done" },
      { id: "b4", label: "Grant application submitted — Dept. of Economic Development", status: "done" },
      { id: "b5", label: "Incorporated under the lower-tax structure", status: "done" },
      { id: "b6", label: "Registered — Tax Commissioner and Social Insurance", status: "done",
        detail: "Payroll tax account open · employer SI registration active" },
    ])
    markComplete(actId)
    await delay(800)

    await addTypedMsg(
      "✓ Business Registered — Right Structure, First Try — Reg. #BC-2026-3317 · 3 agencies · 1 grant most people miss"
    )
    await delay(700)
    await addTypedMsg(
      "The structure, the grant, the registrations — in the right order, first time. Most founders only find out they missed the grant after incorporating. Kezia didn't."
    )
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
      subtitle="Bermuda · Resident · Passport ••••7214"
      userName="Kezia Trott"
      userInitials="KT"
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
