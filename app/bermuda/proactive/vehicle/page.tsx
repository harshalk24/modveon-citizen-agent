"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { ArrowUp, CheckCircle2 } from "lucide-react"
import BermudaLayout from "../../BermudaLayout"
import PreviewMessageRenderer from "../../../preview/components/PreviewMessageRenderer"
import type { PreviewMessage, PreviewActivity } from "../../../preview/types"

let _id = 0
const uid   = (p = "v") => `${p}_${++_id}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const RED   = "#B23A2F"
const NAVY  = "#0F2A4A"

type Chip = { label: string; value: string; primary?: boolean }

// ── Payment summary card ───────────────────────────────────────────────────
function PaymentSummaryCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5" style={{ backgroundColor: NAVY }}>
        <p className="text-xs font-semibold text-white">Payment Summary</p>
      </div>
      <div className="px-4 py-4 space-y-2.5">
        {[
          ["Vehicle",          "BM 4471 · Private Car · Class B"],
          ["Tickets cleared",  "$90"],
          ["Renewal fee",      "$223"],
          ["Total",            "$313"],
          ["Payment method",   "Card on file (•••• 4521)"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-400">{k}</span>
            <span className="font-semibold text-gray-900">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Success card ────────────────────────────────────────────────────────────
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
export default function VehiclePage() {
  const [messages,        setMessages]        = useState<PreviewMessage[]>([])
  const [waitingForInput, setWaitingForInput] = useState<string | null>(null)
  const [currentChips,    setCurrentChips]    = useState<Chip[]>([])
  const bottomRef          = useRef<HTMLDivElement>(null)
  const msgCountRef        = useRef(0)
  const gateRef            = useRef<string | null>(null)
  const startedRef         = useRef(false)

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

  // ── Step 1 ────────────────────────────────────────────────────────────────
  async function step1_open() {
    await delay(1200)
    await addTypedMsg(
      "Hi Alex — your vehicle licence expires in 11 days. Two unpaid parking tickets would've blocked renewal at the counter. I've checked everything and prepared a combined payment."
    )
    await delay(800)
    await step2_toolsAndMessage()
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────
  async function step2_toolsAndMessage() {

    const actId = uid("act1")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "t1", label: "Checking vehicle class and renewal fee",  status: "running" },
        { id: "t2", label: "Verifying inspection status",             status: "waiting" },
        { id: "t3", label: "Cross-checking outstanding tickets",      status: "waiting" },
      ],
    })
    await delay(1500)
    updateAct(actId, [
      { id: "t1", label: "Vehicle licence confirmed — renewal fee: $223", status: "done",
        detail: "BM 4471 · 12-month renewal" },
      { id: "t2", label: "Verifying inspection status",  status: "running" },
      { id: "t3", label: "Cross-checking outstanding tickets", status: "waiting" },
    ])
    await delay(1500)
    updateAct(actId, [
      { id: "t1", label: "Vehicle licence confirmed — renewal fee: $223", status: "done" },
      { id: "t2", label: "Inspection valid — expiry September 2026", status: "done",
        detail: "Not blocking renewal" },
      { id: "t3", label: "Cross-checking outstanding tickets", status: "running" },
    ])
    await delay(1800)
    updateAct(actId, [
      { id: "t1", label: "Vehicle licence confirmed — renewal fee: $223", status: "done" },
      { id: "t2", label: "Inspection valid — expiry September 2026", status: "done" },
      { id: "t3", label: "2 unpaid parking tickets — $90 · would've blocked counter renewal", status: "done",
        detail: "March parking × 2 · $45 + $45 · TCD holds these even when the portal doesn't flag them" },
    ])
    markComplete(actId)
    await delay(800)

    await addTypedMsg(
      "Inspection is clear. Two unpaid parking tickets from March — $90 total. TCD holds them against counter renewals even when the online portal doesn't flag them. I've prepared a combined payment."
    )
    await delay(600)
    await step3a_payBoth()
  }

  // ── Step 3a — pay both ────────────────────────────────────────────────────
  async function step3a_payBoth() {
    const actId = uid("act2")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "p1", label: "Settling 2 outstanding tickets — $90",  status: "running" },
        { id: "p2", label: "Calculating renewal fee",               status: "waiting" },
        { id: "p3", label: "Preparing combined payment — $313",     status: "waiting" },
      ],
    })
    await delay(1500)
    updateAct(actId, [
      { id: "p1", label: "Tickets settled — $90", status: "done",
        detail: "Ticket #T-2026-0342 + #T-2026-0391 cleared from TCD record" },
      { id: "p2", label: "Calculating renewal fee",           status: "running" },
      { id: "p3", label: "Preparing combined payment — $313", status: "waiting" },
    ])
    await delay(1300)
    updateAct(actId, [
      { id: "p1", label: "Tickets settled — $90", status: "done" },
      { id: "p2", label: "Renewal fee confirmed — $223", status: "done",
        detail: "12-month licence" },
      { id: "p3", label: "Preparing combined payment — $313", status: "running" },
    ])
    await delay(1500)
    updateAct(actId, [
      { id: "p1", label: "Tickets settled — $90", status: "done" },
      { id: "p2", label: "Renewal fee confirmed — $223", status: "done" },
      { id: "p3", label: "Payment ready — $313 · awaiting your confirmation", status: "done",
        detail: "Card on file •••• 4521" },
    ])
    markComplete(actId)
    await delay(600)

    addMsg({ id: uid("pay-sum"), type: "payment-summary" as any } as any)
    await delay(400)
    setGate("hitl-confirm", [
      { label: "Confirm & Pay $313", value: "confirm-pay", primary: true },
      { label: "Cancel",             value: "cancel-pay"                  },
    ])
  }

  async function step3a_confirmed() {
    addMsg({ id: uid("u"), type: "user", content: "Confirm & Pay $313" })

    const actId = uid("act3")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "c1", label: "Processing payment — $313", status: "running" },
      ],
    })
    await delay(2200)
    updateAct(actId, [
      { id: "c1", label: "Payment processed", status: "done",
        detail: "Reference: TCD-2026-44871 · Card •••• 4521 · 18 Jun 2026" },
    ])
    markComplete(actId)
    await delay(700)
    await addTypedMsg(
      "✓ Both tickets cleared and licence renewed through June 2027. Clean record, no surprises at the counter."
    )
    await delay(600)
    await addTypedMsg(
      "What used to mean a queue at TCD with a stack of receipts — done in one tap."
    )
  }

  async function step3a_cancelled() {
    addMsg({ id: uid("u"), type: "user", content: "Cancel" })
    await delay(500)
    await addTypedMsg(
      "Paused. Your licence still expires in 11 days — come back when you're ready."
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

    if (gate === "hitl-confirm" && value === "confirm-pay") { await step3a_confirmed(); return }
    if (gate === "hitl-confirm" && value === "cancel-pay")  { await step3a_cancelled(); return }
  }

  return (
    <BermudaLayout
      activeTab="proactive"
      layerLabel="Layer 2 · Act"
      subtitle="Bermuda · Standard Work Permit · Passport ••••4521"
      userName="Alex Morgan"
      userInitials="AM"
    >
      <div className="flex flex-col h-full" style={{ backgroundColor: "#F5F3EE" }}>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          {messages.map(msg => (
            <Fragment key={msg.id}>
              {(msg as any).type === "payment-summary" ? (
                <PaymentSummaryCard />
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
