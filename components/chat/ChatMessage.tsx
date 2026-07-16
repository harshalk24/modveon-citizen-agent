"use client"

import { useState } from "react"
import { Flag, ExternalLink, Download, Info, Sparkles } from "lucide-react"
import { useLang } from "@/contexts/LanguageContext"
import { t } from "@/lib/i18n"
import AgentActivityCard    from "./AgentActivityCard"
import FormPreviewCard      from "./FormPreviewCard"
import DocRetrievedCard     from "./DocRetrievedCard"
import DocRequestCard       from "./DocRequestCard"
import ConfirmationCard     from "./ConfirmationCard"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  type?: "user" | "assistant" | "activity" | "form-preview" | "doc-request" | "doc-retrieved" | "confirmation" | "status-update"
  // Server-computed classification tag for this reply (e.g. "confirming", "meta",
  // "service-lookup") — drives which follow-up suggestion chips are relevant.
  // Undefined for client-only messages (onboarding steps never call /api/chat).
  uiState?: string
  hasServices?: boolean
  activities?:       import("./AgentActivityCard").AgentActivity[]
  formData?:         import("./FormPreviewCard").FormPreviewData
  docRequest?:       import("./DocRequestCard").DocRequestData
  docRetrieved?:     import("./DocRetrievedCard").DocRetrievedData
  confirmationData?: import("./ConfirmationCard").ConfirmationData
  submitted?: boolean
  resolved?:  boolean
  actionButtons?: { label: string; action: string; variant?: "outline" | "green" }[]
}

interface Props {
  message: Message
  citizenId?: string
  onAction?:      (action: string) => void
  onSendMessage?: (text: string) => void
  onApplyNow?:    (serviceId: string) => void
  onDocAction?:   (msgId: string, action: string, value?: string) => void
  onFormConfirm?: (msgId: string) => void
  onConfirmation?:(msgId: string, value: string) => void
  dataTour?: string
}

function formatDocName(slug: string) {
  return slug.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")
}

function renderInline(text: string, onKnowMore: (d: string) => void, lang: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|DOC_INFO:[a-zA-Z0-9_-]+|https?:\/\/[^\s<>"')\]]+)/)
  return parts.filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (lm) return <a key={i} href={lm[2]} target="_blank" rel="noopener noreferrer" className="text-[#1B3A8C] underline underline-offset-2 hover:text-[#152D70] break-all">{lm[1]}</a>
    const dm = part.match(/^DOC_INFO:([a-zA-Z0-9_-]+)$/)
    if (dm) return (
      <button key={i} onClick={() => onKnowMore(dm[1])}
        className="inline-flex items-center justify-center w-5 h-5 ml-1 align-middle text-[#1B3A8C] border border-blue-200 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors"
        title={lang === "es" ? `Saber más sobre ${formatDocName(dm[1])}` : `Learn more about ${formatDocName(dm[1])}`}>
        <Info size={10} />
      </button>
    )
    if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#1B3A8C] underline underline-offset-2 break-all">{part}</a>
    return part
  })
}

function AgentMarkdown({ text, onKnowMore, lang }: { text: string; onKnowMore: (d: string) => void; lang: string }) {
  const lines = text.split("\n")
  const nodes: React.ReactNode[] = []
  let i = 0
  let olNum = 0  // running counter — survives interleaved bullets / blank lines
  while (i < lines.length) {
    const line = lines[i]
    // Skip horizontal rules from LLM output (--- renders as text otherwise)
    if (/^---+$/.test(line.trim())) { i++; continue }
    // Strip the PLAN_STEPS: UI signal (chip-state marker, not user-visible)
    if (/^PLAN_STEPS:\s*$/.test(line.trim())) { i++; continue }
    if (/^[\*\-]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\*\-]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[\*\-]\s+/, "")); i++ }
      nodes.push(<ul key={`ul-${i}`} className="list-disc pl-4 space-y-1 my-1">{items.map((x, j) => <li key={j}>{renderInline(x, onKnowMore, lang)}</li>)}</ul>)
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      olNum++
      const content = line.replace(/^\d+\.\s+/, "")
      nodes.push(
        <div key={`ol-${i}`} className="flex gap-2 my-1">
          <span className="font-medium tabular-nums shrink-0">{olNum}.</span>
          <span>{renderInline(content, onKnowMore, lang)}</span>
        </div>
      )
      i++
      continue
    }
    if (line.trim() === "") { nodes.push(<div key={`br-${i}`} className="h-1" />); i++; continue }
    nodes.push(<p key={`p-${i}`} className="leading-relaxed">{renderInline(line, onKnowMore, lang)}</p>)
    i++
  }
  return <div className="space-y-1 text-sm">{nodes}</div>
}

function BenefitCard({ content, applyUrl, downloadUrl, onKnowMore, lang, onApplyNow }: {
  content: string; applyUrl: string; downloadUrl?: string
  onKnowMore: (d: string) => void; lang: string; onApplyNow?: (id: string) => void
}) {
  const nm = content.match(/\*\*([^*]+)\*\*/)
  const am = content.match(/\$[\d,]+(?:\/(?:mo|month|week|wk|year|yr))?/)
  const isUrgent = /\b(\d+\s*days?|días?\s*para|plazo|deadline)\b/i.test(content)
  const isRNPN   = applyUrl?.includes("rnpn.gob.sv")

  // Apply now node — reused in header
  const applyNode = isRNPN && onApplyNow ? (
    <button onClick={() => onApplyNow("sv-rnpn-birth-registration")}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#FFC400] text-yellow-900 rounded-lg hover:bg-[#E5AF00] transition-colors flex-shrink-0">
      <Sparkles size={10} />
      {lang === "es" ? "Tramitar" : "Apply now"}
    </button>
  ) : applyUrl ? (
    <a href={applyUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#FFC400] text-yellow-900 rounded-lg hover:bg-[#E5AF00] transition-colors flex-shrink-0">
      <ExternalLink size={10} />
      {lang === "es" ? "Solicitar" : "Apply now"}
    </a>
  ) : null

  return (
    <div className={`border-l-4 ${isUrgent ? "border-red-500" : "border-[#FFC400]"} bg-white rounded-r-xl p-3 mb-3 shadow-sm min-h-[80px]`}>
      {/* Header row: name + amount badge + Apply now in top-right */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {nm && <span className="font-semibold text-sm text-gray-800">{nm[1]}</span>}
          {am && <span className="text-xs font-semibold px-2 py-0.5 bg-[#FFF7CC] text-yellow-800 rounded flex-shrink-0">{am[0]}</span>}
        </div>
        {applyNode}
      </div>

      <div className="text-sm text-gray-700">
        <AgentMarkdown text={content} onKnowMore={onKnowMore} lang={lang} />
      </div>

      {/* Footer: Learn more + Download only */}
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <button
          onClick={() => onKnowMore(`BENEFIT:${nm ? nm[1] : "this benefit"}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1B3A8C] border border-[#1B3A8C] rounded-lg hover:bg-blue-50 transition-colors">
          <Info size={11} />
          {lang === "es" ? "Saber más" : "Learn more"}
        </button>
        {downloadUrl && (
          <a href={downloadUrl} download target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1B3A8C] border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
            <Download size={11} />
            {lang === "es" ? "Descargar" : "Download"}
          </a>
        )}
      </div>
    </div>
  )
}

function renderContent(content: string, lang: string, onKnowMore: (d: string) => void, onApplyNow?: (id: string) => void) {
  const parts = content.split(/(APPLY_NOW:https?:\/\/[^\s\n]+(?:\s+DOWNLOAD:https?:\/\/[^\s\n]+)?)/)
  const result: React.ReactNode[] = []
  let buf = ""
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    const am = part.match(/^APPLY_NOW:(https?:\/\/[^\s]+?)(?:\s+DOWNLOAD:(https?:\/\/[^\s]+))?$/)
    if (am) { result.push(<BenefitCard key={i} content={buf} applyUrl={am[1]} downloadUrl={am[2]} onKnowMore={onKnowMore} lang={lang} onApplyNow={onApplyNow} />); buf = "" }
    else buf += part
  }
  if (buf.trim()) result.push(<AgentMarkdown key="trailing" text={buf} onKnowMore={onKnowMore} lang={lang} />)
  return result
}

export default function ChatMessage({ message, citizenId, onAction, onSendMessage, onApplyNow, onDocAction, onFormConfirm, onConfirmation, dataTour }: Props) {
  const { lang } = useLang()
  const tr = t(lang)
  const [flagged, setFlagged] = useState(false)

  if (!message.content && message.role === "assistant" && !message.type) return null

  const isAgent = message.role === "assistant"

  const handleFlag = async () => {
    setFlagged(true)
    await fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ citizenId, messageId: message.id, type: "wrong-info" }),
    }).catch(() => {})
  }
  const handleKnowMore = (docId: string) => {
    if (docId.startsWith("BENEFIT:")) {
      const name = docId.slice(8)
      onSendMessage?.(`Tell me more about **${name}**: how do I apply, what are the exact requirements, how long does it take, and what documents do I need?`)
    } else {
      onSendMessage?.(`Tell me about the document: ${formatDocName(docId)}. What is it, where do I get it if I don't have it, and how long does it take?`)
    }
  }

  // ── Special message types ────────────────────────────────
  if (message.type === "activity" && message.activities) {
    const isComplete = message.activities.every(a => a.status === "done" || a.status === "failed")
    return (
      <div className="flex justify-start animate-msg-in" data-tour={dataTour}>
        <div className="max-w-[85%]">
          <div className="text-[11px] text-gray-400 px-1 mb-1">{tr.chat.agentName}</div>
          <AgentActivityCard activities={message.activities} isComplete={isComplete} language={lang} />
        </div>
      </div>
    )
  }
  if (message.type === "form-preview" && message.formData) return (
    <div className="flex justify-start animate-msg-in" data-tour={dataTour}>
      <div className="max-w-[90%] w-full">
        <div className="text-[11px] text-gray-400 px-1 mb-1">{tr.chat.agentName}</div>
        <FormPreviewCard data={message.formData} submitted={message.submitted} onConfirm={() => onFormConfirm?.(message.id)} language={lang} />
      </div>
    </div>
  )
  if (message.type === "doc-retrieved" && message.docRetrieved) return (
    <div className="flex justify-start animate-msg-in" data-tour={dataTour}>
      <div className="max-w-[85%]">
        <div className="text-[11px] text-gray-400 px-1 mb-1">{tr.chat.agentName}</div>
        <DocRetrievedCard data={message.docRetrieved} language={lang} />
      </div>
    </div>
  )
  if (message.type === "doc-request" && message.docRequest) return (
    <div className="flex justify-start animate-msg-in" data-tour={dataTour}>
      <div className="max-w-[85%]">
        <div className="text-[11px] text-gray-400 px-1 mb-1">{tr.chat.agentName}</div>
        <DocRequestCard data={message.docRequest} resolved={message.resolved} onAction={(a, v) => onDocAction?.(message.id, a, v)} language={lang} />
      </div>
    </div>
  )
  if (message.type === "confirmation" && message.confirmationData) return (
    <div className="flex justify-start animate-msg-in" data-tour={dataTour}>
      <div className="max-w-[85%]">
        <div className="text-[11px] text-gray-400 px-1 mb-1">{tr.chat.agentName}</div>
        <ConfirmationCard data={message.confirmationData} resolved={message.resolved} onChoice={v => onConfirmation?.(message.id, v)} language={lang} />
      </div>
    </div>
  )

  // ── Regular message ──────────────────────────────────────
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"} group animate-msg-in`} data-tour={dataTour}>
      <div className={`max-w-[85%] ${isAgent ? "space-y-2" : ""}`}>
        {isAgent && <div className="text-[11px] text-gray-400 px-1 mb-1">{tr.chat.agentName}</div>}
        <div
          className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isAgent ? "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm" : "bg-[#FFC400] text-yellow-900 rounded-tr-sm font-medium"
          }`}
          style={isAgent ? { borderLeft: "3px solid #E8F0FE" } : {}}
        >
          {isAgent ? renderContent(message.content, lang, handleKnowMore, onApplyNow) : <p className="whitespace-pre-wrap">{message.content}</p>}
          {isAgent && (
            <button onClick={handleFlag} title={tr.chat.flagTooltip}
              className={`absolute -bottom-1 -right-1 p-1 rounded-full transition-all ${flagged ? "opacity-100 text-red-400 bg-white shadow-sm" : "opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 bg-white shadow-sm"}`}>
              <Flag size={10} />
            </button>
          )}
        </div>
        {isAgent && message.actionButtons?.length ? (
          <div className="flex flex-wrap gap-2 px-1">
            {message.actionButtons.map((btn, i) => (
              <button key={i} onClick={() => onAction?.(btn.action)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  btn.variant === "green" ? "bg-[#FFC400] hover:bg-[#E5AF00] text-yellow-900" : "border border-gray-300 hover:border-[#1B3A8C] hover:text-[#1B3A8C] text-gray-600"
                }`}>
                {btn.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
