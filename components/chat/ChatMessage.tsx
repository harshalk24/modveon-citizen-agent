"use client"

import { useState } from "react"
import { Flag, Download, Info, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react"
import { useLang } from "@/contexts/LanguageContext"
import { t } from "@/lib/i18n"
import { services as kbServices } from "@/lib/kb"
import type { Service } from "@/lib/kb"
import ServiceCard         from "./BenefitCard"
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
  // Task DISCOVERY_CARDS: structured benefit cards to render below the intro
  // bubble on a discovery reply (service reply types). Built client-side from
  // the gender-gated unionServicesForSituations snapshot — NOT parsed from the
  // reply prose. Absent on non-discovery replies (they render prose as before).
  benefitCards?: Service[]
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

function domainOf(url?: string): string {
  if (!url) return ""
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "" }
}

// mirrors isUnverified() in lib/grounding.ts / isUnverifiedLocal() in
// app/chat/page.tsx — keep in sync. Duplicated (not imported) for the same
// reason page.tsx's copy is: grounding.ts may pull server-only deps into the
// client bundle, and a page component isn't a module other files should import.
function isUnverifiedLocal(s: { reviewStatus?: string; confidence?: number }) {
  if (s.reviewStatus === "needs_review") return true
  if (s.reviewStatus === "approved") return false
  if (typeof s.confidence === "number") return s.confidence < 0.8
  return true
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

// Task UI_REDESIGN (plan-in-thread, 1d): a light, scoped extraction — same
// spirit as BenefitCard's existing name/amount regex, not a new architecture.
// Pulls a leading/trailing timeframe phrase ("within 30 days", "en 30 días")
// out of a step's raw text so it can render as its own "⏱" pill instead of
// buried in the title.
function extractStepMeta(raw: string): { title: string; timeframe?: string } {
  const m = raw.match(/\b((?:within|up to|after|en|dentro de|hasta|después de)\s+\d+\s*(?:days?|weeks?|months?|years?|días?|semanas?|meses?|años?)\b(?:\s+(?:after|of|después de|de)\s+[a-záéíóúñ]+)?)/i)
  if (!m || m.index === undefined) return { title: raw }
  const timeframe = m[1].trim()
  const title = (raw.slice(0, m.index) + raw.slice(m.index + m[0].length))
    .replace(/\s{2,}/g, " ").trim()
    .replace(/[,:\-–—]\s*$/, "").replace(/^[,:\-–—]\s*/, "")
  return { title: title || raw, timeframe }
}

// Confident, unique match only (agency AND the service's own name both
// present in the step's text) — an agency name alone is ambiguous (several
// services often share one agency), so a bare agency hit is not enough to
// assert a trust state. No match → no trust chip for that step (omit,
// never guess) — same discipline as BenefitCard's KB lookup below.
function findStepService(text: string) {
  const lower = text.toLowerCase()
  const agencyMatches = kbServices.filter(s => lower.includes(s.agency.toLowerCase()))
  const confident = agencyMatches.filter(s => lower.includes(s.name.toLowerCase()) || lower.includes(s.nameEs.toLowerCase()))
  return confident.length === 1 ? confident[0] : undefined
}

// A step's raw block can be a flat one-liner ("Register the birth at RNPN")
// OR a numbered HEADER followed by indented bullet detail (confirmed live —
// the model sometimes writes "1.\nFor the Police Background Certificate:\n
// - Go to the PNC office...\n- Bring your valid DUI..."). Splits on whichever
// lines are bullets vs plain text so both shapes render correctly instead of
// the bullets silently falling through as unstyled paragraph text.
function splitStepBlock(raw: string): { title: string; bullets: string[] } {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean)
  const titleLines: string[] = []
  const bullets: string[] = []
  for (const l of lines) {
    if (/^[\*\-]\s+/.test(l)) bullets.push(l.replace(/^[\*\-]\s+/, ""))
    else if (bullets.length === 0) titleLines.push(l)
  }
  const title = titleLines.join(" ").trim()
  // Every line was a bullet (no header at all) — use the first as a
  // synthetic title rather than render an empty heading.
  if (!title) return { title: bullets[0] || raw.trim(), bullets: bullets.slice(1) }
  return { title, bullets }
}

function PlanStepper({ items, onKnowMore, onSendMessage, lang }: {
  items: string[]; onKnowMore: (d: string) => void; onSendMessage?: (t: string) => void; lang: string
}) {
  const steps = items.map(raw => {
    const { title: rawTitle, bullets } = splitStepBlock(raw)
    const { title, timeframe } = extractStepMeta(rawTitle)
    // Trust/timeframe matching searches the FULL block (title + bullets),
    // not just the title line — the service name/agency more often appears
    // in the header, but a timeframe hint can land in either.
    const svc = findStepService(raw)
    const unverified = svc ? isUnverifiedLocal({ reviewStatus: svc.reviewStatus, confidence: svc.confidence }) : undefined
    return { title, timeframe, bullets, svc, unverified }
  })
  const firstUrl = steps[0]?.svc?.sourceUrl

  return (
    <div className="mt-2">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-3.5 relative pb-4 last:pb-0">
          {i < steps.length - 1 && <span className="absolute left-[13px] top-[30px] bottom-0 w-[2px] bg-ca-surface-border" />}
          <div className={`relative z-[1] flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${
            i === 0 ? "bg-brand text-white" : "bg-brand-light text-brand border-[1.5px] border-[#D5E4F4]"
          }`}>
            {i + 1}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[14.5px] font-semibold text-gray-900">{renderInline(s.title, onKnowMore, lang)}</p>
            {(s.timeframe || s.unverified !== undefined) && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {s.timeframe && <span className="text-xs text-ca-text-secondary">⏱ {s.timeframe}</span>}
                {s.unverified === false && (
                  <span className="inline-flex items-center gap-1 bg-ca-success-light text-ca-success text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} />{lang === "es" ? "Verificado" : "Verified"}
                  </span>
                )}
                {s.unverified === true && (
                  <span className="inline-flex items-center gap-1 bg-ca-warn-light text-ca-warn text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    <AlertCircle size={10} />{lang === "es" ? "Confirmar" : "Confirm"}
                  </span>
                )}
              </div>
            )}
            {s.bullets.length > 0 && (
              <ul className="list-disc pl-4 space-y-0.5 mt-1.5 text-[13px] text-gray-700">
                {s.bullets.map((b, bi) => <li key={bi}>{renderInline(b, onKnowMore, lang)}</li>)}
              </ul>
            )}
          </div>
        </div>
      ))}
      {firstUrl ? (
        <a href={firstUrl} target="_blank" rel="noopener noreferrer"
          className="w-full mt-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white py-3 rounded-[11px] text-[14.5px] font-bold transition-colors">
          {lang === "es" ? "Empezar con el paso 1" : "Start with step 1"} · {domainOf(firstUrl)}
          <ArrowUpRight size={15} />
        </a>
      ) : onSendMessage ? (
        <button
          onClick={() => onSendMessage(lang === "es" ? "¿Cómo empiezo con el paso 1?" : "How do I start with step 1?")}
          className="w-full mt-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white py-3 rounded-[11px] text-[14.5px] font-bold transition-colors">
          {lang === "es" ? "Empezar con el paso 1" : "Start with step 1"}
          <ArrowUpRight size={15} />
        </button>
      ) : null}
    </div>
  )
}

function AgentMarkdown({ text, onKnowMore, onSendMessage, lang }: {
  text: string; onKnowMore: (d: string) => void; onSendMessage?: (t: string) => void; lang: string
}) {
  const lines = text.split("\n")
  const nodes: React.ReactNode[] = []
  let i = 0
  let olNum = 0        // running counter for the PLAIN numbered-list path — survives interleaved bullets / blank lines
  let sawPlanSteps = false  // Task CHIPS_V4 / UI_REDESIGN: once PLAN_STEPS: is stripped, the NEXT
                            // numbered-list block in this reply is the real action-step sequence —
                            // render it as PlanStepper instead of a plain numbered line.
  while (i < lines.length) {
    const line = lines[i]
    // Skip horizontal rules from LLM output (--- renders as text otherwise)
    if (/^---+$/.test(line.trim())) { i++; continue }
    // Strip the PLAN_STEPS: UI signal (chip-state marker, not user-visible)
    if (/^PLAN_STEPS:\s*$/.test(line.trim())) { sawPlanSteps = true; i++; continue }
    // Leading whitespace tolerated — confirmed live that the model sometimes
    // indents bullets as nested detail under a numbered step; `^[\*\-]` alone
    // (no `\s*` prefix) silently misses those and lets them fall through as
    // plain unstyled paragraph text.
    if (/^\s*[\*\-]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[\*\-]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[\*\-]\s+/, "")); i++ }
      nodes.push(<ul key={`ul-${i}`} className="list-disc pl-4 space-y-1 my-1">{items.map((x, j) => <li key={j}>{renderInline(x, onKnowMore, lang)}</li>)}</ul>)
      continue
    }
    if (/^\s*\d+\.\s*/.test(line)) {
      // Task UI_REDESIGN — confirmed live that a numbered item isn't always a
      // flat one-liner: the model can write a bare "N." header followed by
      // indented bullet detail on subsequent lines. Absorb everything up to
      // the NEXT numbered marker into that step's raw block; splitStepBlock
      // (below / in PlanStepper) separates the leading title from trailing
      // bullets either way, so both shapes render correctly instead of the
      // nested case silently degrading to unstyled paragraphs.
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s*/.test(lines[i])) {
        let block = lines[i].replace(/^\s*\d+\.\s*/, "")
        i++
        while (i < lines.length && !/^\s*\d+\.\s*/.test(lines[i])) {
          if (lines[i].trim() === "") {
            const next = lines[i + 1]
            if (next === undefined || (!/^\s*[\*\-]\s+/.test(next) && !/^\s*\d+\.\s*/.test(next))) break
            i++; continue
          }
          block += "\n" + lines[i]
          i++
        }
        items.push(block.trim())
      }
      if (sawPlanSteps) {
        nodes.push(<PlanStepper key={`plan-${i}`} items={items} onKnowMore={onKnowMore} onSendMessage={onSendMessage} lang={lang} />)
      } else {
        nodes.push(
          <div key={`ol-${i}`} className="space-y-1 my-1">
            {items.map((raw, j) => {
              const { title, bullets } = splitStepBlock(raw)
              return (
                <div key={j}>
                  <div className="flex gap-2">
                    <span className="font-medium tabular-nums shrink-0">{olNum + j + 1}.</span>
                    <span>{renderInline(title, onKnowMore, lang)}</span>
                  </div>
                  {bullets.length > 0 && (
                    <ul className="list-disc pl-8 space-y-0.5 mt-0.5">
                      {bullets.map((b, bi) => <li key={bi}>{renderInline(b, onKnowMore, lang)}</li>)}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )
        olNum += items.length
      }
      continue
    }
    if (line.trim() === "") { nodes.push(<div key={`br-${i}`} className="h-1" />); i++; continue }
    nodes.push(<p key={`p-${i}`} className="leading-relaxed">{renderInline(line, onKnowMore, lang)}</p>)
    i++
  }
  return <div className="space-y-1 text-sm">{nodes}</div>
}

function TrustChip({ unverified, domain, lang }: { unverified: boolean; domain: string; lang: string }) {
  if (unverified) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-ca-warn-light text-ca-warn text-[11.5px] font-semibold px-2.5 py-1 rounded-full">
        <AlertCircle size={12} />
        {lang === "es" ? "Confirmar al aplicar" : "Confirm when you apply"}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-ca-success-light text-ca-success text-[11.5px] font-semibold px-2.5 py-1 rounded-full">
      <CheckCircle2 size={12} />
      {lang === "es" ? `Verificado · ${domain}` : `Verified · ${domain}`}
    </span>
  )
}

function BenefitCard({ content, applyUrl, downloadUrl, onKnowMore, lang, onApplyNow }: {
  content: string; applyUrl: string; downloadUrl?: string
  onKnowMore: (d: string) => void; lang: string; onApplyNow?: (id: string) => void
}) {
  const nm = content.match(/\*\*([^*]+)\*\*/)
  const am = content.match(/\$[\d,]+(?:\/(?:mo|month|week|wk|year|yr))?/)
  const isFreeText = !am && /(?:^|[\s·])(?:Free|Gratis)(?:[\s.,;]|$)/i.test(content)
  const isRNPN   = applyUrl?.includes("rnpn.gob.sv")

  // Task UI_REDESIGN — trust chip (guardrail #2): looked up by matching the
  // APPLY_NOW: URL back to its KB entry (both already flow through the
  // existing marker, so this is a reliable structural match, not prose-
  // guessing). No match → no trust chip at all (omit, don't fabricate).
  const kbMatch = kbServices.find(s => s.sourceUrl === applyUrl)
  const unverified = kbMatch ? isUnverifiedLocal({ reviewStatus: kbMatch.reviewStatus, confidence: kbMatch.confidence }) : undefined
  const domain = domainOf(applyUrl)

  const applyNode = isRNPN && onApplyNow ? (
    <button onClick={() => onApplyNow("sv-rnpn-birth-registration")}
      className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-dark transition-colors flex-shrink-0 whitespace-nowrap">
      {lang === "es" ? "Tramitar" : "Apply"} →
    </button>
  ) : applyUrl ? (
    <a href={applyUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-dark transition-colors flex-shrink-0 whitespace-nowrap">
      {lang === "es" ? "Solicitar" : "Apply"} →
    </a>
  ) : null

  return (
    <div className={`rounded-[11px] p-3.5 mb-3 ${unverified ? "bg-[#FDFBF3] border border-ca-warn-border" : "bg-white border border-ca-surface-border"}`}>
      {/* Header row: name + cost pill top-right */}
      <div className="flex items-start justify-between gap-2">
        {nm && <span className="font-bold text-[14.5px] text-gray-900 min-w-0">{nm[1]}</span>}
        {isFreeText ? (
          <span className="text-[11.5px] font-bold px-2.5 py-0.5 bg-ca-success-light text-ca-success rounded-full flex-shrink-0 whitespace-nowrap">
            {lang === "es" ? "Gratis" : "Free"}
          </span>
        ) : am ? (
          <span className="text-[11.5px] font-bold px-2.5 py-0.5 bg-ca-track text-[#475569] rounded-full flex-shrink-0 whitespace-nowrap">{am[0]}</span>
        ) : null}
      </div>

      <div className="text-[13px] text-gray-700 mt-1">
        <AgentMarkdown text={content} onKnowMore={onKnowMore} lang={lang} />
      </div>

      {/* Trust chip + Apply — the mock's primary footer row */}
      <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
        <div>{unverified !== undefined && <TrustChip unverified={unverified} domain={domain} lang={lang} />}</div>
        {applyNode}
      </div>

      {/* Learn more + Download — additional real capabilities the mock's
          simplified example didn't happen to render; kept as a secondary row. */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button
          onClick={() => onKnowMore(`BENEFIT:${nm ? nm[1] : "this benefit"}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand border border-brand rounded-lg hover:bg-brand-light transition-colors">
          <Info size={11} />
          {lang === "es" ? "Saber más" : "Learn more"}
        </button>
        {downloadUrl && (
          <a href={downloadUrl} download target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand border border-brand-light rounded-lg bg-brand-light hover:opacity-80 transition-colors">
            <Download size={11} />
            {lang === "es" ? "Descargar" : "Download"}
          </a>
        )}
      </div>
    </div>
  )
}

function renderContent(content: string, lang: string, onKnowMore: (d: string) => void, onApplyNow?: (id: string) => void, onSendMessage?: (t: string) => void) {
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
  if (buf.trim()) result.push(<AgentMarkdown key="trailing" text={buf} onKnowMore={onKnowMore} onSendMessage={onSendMessage} lang={lang} />)
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
          <div className="text-xs text-ca-text-tertiary px-1 mb-1.5 font-medium">{tr.chat.agentName}</div>
          <AgentActivityCard activities={message.activities} isComplete={isComplete} language={lang} />
        </div>
      </div>
    )
  }
  if (message.type === "form-preview" && message.formData) return (
    <div className="flex justify-start animate-msg-in" data-tour={dataTour}>
      <div className="max-w-[90%] w-full">
        <div className="text-xs text-ca-text-tertiary px-1 mb-1.5 font-medium">{tr.chat.agentName}</div>
        <FormPreviewCard data={message.formData} submitted={message.submitted} onConfirm={() => onFormConfirm?.(message.id)} language={lang} />
      </div>
    </div>
  )
  if (message.type === "doc-retrieved" && message.docRetrieved) return (
    <div className="flex justify-start animate-msg-in" data-tour={dataTour}>
      <div className="max-w-[85%]">
        <div className="text-xs text-ca-text-tertiary px-1 mb-1.5 font-medium">{tr.chat.agentName}</div>
        <DocRetrievedCard data={message.docRetrieved} language={lang} />
      </div>
    </div>
  )
  if (message.type === "doc-request" && message.docRequest) return (
    <div className="flex justify-start animate-msg-in" data-tour={dataTour}>
      <div className="max-w-[85%]">
        <div className="text-xs text-ca-text-tertiary px-1 mb-1.5 font-medium">{tr.chat.agentName}</div>
        <DocRequestCard data={message.docRequest} resolved={message.resolved} onAction={(a, v) => onDocAction?.(message.id, a, v)} language={lang} />
      </div>
    </div>
  )
  if (message.type === "confirmation" && message.confirmationData) return (
    <div className="flex justify-start animate-msg-in" data-tour={dataTour}>
      <div className="max-w-[85%]">
        <div className="text-xs text-ca-text-tertiary px-1 mb-1.5 font-medium">{tr.chat.agentName}</div>
        <ConfirmationCard data={message.confirmationData} resolved={message.resolved} onChoice={v => onConfirmation?.(message.id, v)} language={lang} />
      </div>
    </div>
  )

  // ── Regular message ──────────────────────────────────────
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"} group animate-msg-in`} data-tour={dataTour}>
      <div className={`max-w-[85%] ${isAgent ? "space-y-2" : ""}`}>
        {isAgent && <div className="text-xs text-ca-text-tertiary px-1 mb-1.5 font-medium">{tr.chat.agentName}</div>}
        <div
          className={`relative px-5 py-4 text-[15px] leading-[1.6] ${
            isAgent
              ? "bg-white border border-ca-surface-border text-[#1E293B] rounded-[4px_15px_15px_15px] shadow-[0_1px_3px_rgba(16,24,40,.05)]"
              : "bg-ca-yellow text-ca-ink rounded-[15px_15px_4px_15px] font-medium"
          }`}
        >
          {isAgent ? renderContent(message.content, lang, handleKnowMore, onApplyNow, onSendMessage) : <p className="whitespace-pre-wrap">{message.content}</p>}
          {isAgent && (
            <button onClick={handleFlag} title={tr.chat.flagTooltip}
              className={`absolute -bottom-1 -right-1 p-1 rounded-full transition-all ${flagged ? "opacity-100 text-red-400 bg-white shadow-sm" : "opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 bg-white shadow-sm"}`}>
              <Flag size={10} />
            </button>
          )}
        </div>
        {/* Task DISCOVERY_CARDS: structured benefit cards below the intro
            bubble — the discovery listing, rendered from data instead of prose. */}
        {isAgent && message.benefitCards && message.benefitCards.length > 0 && (
          <div className="space-y-2.5">
            {message.benefitCards.map(s => (
              <ServiceCard key={s.id} service={s} lang={lang === "es" ? "es" : "en"} onKnowMore={handleKnowMore} />
            ))}
          </div>
        )}
        {isAgent && message.actionButtons?.length ? (
          <div className="flex flex-wrap gap-2 px-1">
            {message.actionButtons.map((btn, i) => (
              <button key={i} onClick={() => onAction?.(btn.action)}
                className={`text-[13px] px-3.5 py-2 rounded-full font-medium transition-colors ${
                  btn.variant === "green"
                    ? "bg-ca-yellow-light border border-ca-yellow text-[#7A5B00] font-semibold hover:bg-ca-yellow/20"
                    : "border border-ca-surface-input text-[#475569] hover:border-ca-yellow bg-white"
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
