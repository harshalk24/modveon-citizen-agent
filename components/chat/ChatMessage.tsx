"use client"

import { useState } from "react"
import { Flag, ExternalLink, Download, Info } from "lucide-react"
import { useLang } from "@/contexts/LanguageContext"
import { t } from "@/lib/i18n"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  actionButtons?: { label: string; action: string; variant?: "outline" | "green" }[]
}

interface Props {
  message: Message
  citizenId?: string
  onAction?: (action: string) => void
  onSendMessage?: (text: string) => void
  dataTour?: string
}

// ── Helpers ───────────────────────────────────────────────
function formatDocName(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// ── Inline renderer: **bold**, [text](url), bare URLs, DOC_INFO:[slug] ──
function renderInline(
  text: string,
  onKnowMore: (docId: string) => void,
  lang: string
): React.ReactNode[] {
  // Split on: bold, markdown links, DOC_INFO tags, bare https?:// URLs
  const parts = text.split(
    /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|DOC_INFO:[a-zA-Z0-9_-]+|https?:\/\/[^\s<>"')\]]+)/
  )
  return parts.filter(p => p !== undefined && p !== "").map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="text-[#185FA5] underline underline-offset-2 hover:text-[#145290] transition-colors break-all">
          {linkMatch[1]}
        </a>
      )
    }
    const docMatch = part.match(/^DOC_INFO:([a-zA-Z0-9_-]+)$/)
    if (docMatch) {
      const docId = docMatch[1]
      const docName = formatDocName(docId)
      return (
        <button
          key={i}
          onClick={() => onKnowMore(docId)}
          className="inline-flex items-center justify-center w-5 h-5 ml-1 align-middle
                     text-[#185FA5] border border-[#B5D4F4] rounded-full
                     bg-[#E6F1FB] hover:bg-[#B5D4F4] transition-colors"
          title={lang === "es" ? `Saber más sobre ${docName}` : `Learn more about ${docName}`}
        >
          <Info size={10} />
        </button>
      )
    }
    // Bare URL — render as a clickable link
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-[#185FA5] underline underline-offset-2 hover:text-[#145290] transition-colors break-all">
          {part}
        </a>
      )
    }
    return part
  })
}

// ── Block renderer: bullets, numbered lists, paragraphs ──────────────
function AgentMarkdown({
  text, onKnowMore, lang
}: {
  text: string
  onKnowMore: (docId: string) => void
  lang: string
}) {
  const lines = text.split("\n")
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^[\*\-]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\*\-]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\*\-]\s+/, ""))
        i++
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 space-y-1 my-1">
          {items.map((item, j) => <li key={j}>{renderInline(item, onKnowMore, lang)}</li>)}
        </ul>
      )
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""))
        i++
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 space-y-1 my-1">
          {items.map((item, j) => <li key={j}>{renderInline(item, onKnowMore, lang)}</li>)}
        </ol>
      )
      continue
    }

    if (line.trim() === "") {
      nodes.push(<div key={`br-${i}`} className="h-1" />)
      i++
      continue
    }

    nodes.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInline(line, onKnowMore, lang)}
      </p>
    )
    i++
  }

  return <div className="space-y-1 text-sm">{nodes}</div>
}

// ── Benefit card: wraps a content block + APPLY_NOW ───────────────────
function BenefitCard({
  content, applyUrl, downloadUrl, onKnowMore, lang
}: {
  content: string
  applyUrl: string
  downloadUrl?: string
  onKnowMore: (docId: string) => void
  lang: string
}) {
  // Extract first **bold** phrase as the benefit name
  const nameMatch = content.match(/\*\*([^*]+)\*\*/)
  const benefitName = nameMatch ? nameMatch[1] : null

  // Extract dollar amounts for the badge
  const amountMatch = content.match(/\$[\d,]+(?:\/(?:mo|month|week|wk|year|yr))?/)
  const amount = amountMatch ? amountMatch[0] : null

  // Urgent = content mentions deadline in days
  const isUrgent = /\b(\d+\s*days?|días?\s*para|plazo|deadline)\b/i.test(content)

  return (
    <div className={`border-l-4 min-h-[80px] ${isUrgent ? "border-red-500" : "border-[#185FA5]"} bg-white rounded-r-lg p-3 mb-3 shadow-sm`}>
      {(benefitName || amount) && (
        <div className="flex items-center justify-between mb-1.5">
          {benefitName && (
            <span className="font-medium text-sm text-gray-900">{benefitName}</span>
          )}
          {amount && (
            <span className="text-xs font-medium px-2 py-0.5 bg-green-50 text-green-700 rounded ml-2 flex-shrink-0">
              {amount}
            </span>
          )}
        </div>
      )}
      <div className="text-sm text-gray-700">
        <AgentMarkdown text={content} onKnowMore={onKnowMore} lang={lang} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <a href={applyUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5
                     text-xs font-semibold text-white bg-[#185FA5]
                     rounded-lg hover:bg-[#145290] transition-colors">
          <ExternalLink size={11} />
          {lang === "es" ? "Aplicar ahora" : "Apply now"}
        </a>
        {downloadUrl && (
          <a href={downloadUrl} download target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5
                       text-xs font-medium text-[#185FA5] border border-[#B5D4F4]
                       rounded-lg bg-[#E6F1FB] hover:bg-[#B5D4F4] transition-colors">
            <Download size={11} />
            {lang === "es" ? "Descargar formulario" : "Download form"}
          </a>
        )}
      </div>
    </div>
  )
}

// ── Full content renderer: splits on APPLY_NOW into benefit cards ─────
function renderContent(
  content: string,
  lang: string,
  onKnowMore: (docId: string) => void
) {
  // Split on APPLY_NOW tags (with optional DOWNLOAD on same token)
  const parts = content.split(
    /(APPLY_NOW:https?:\/\/[^\s\n]+(?:\s+DOWNLOAD:https?:\/\/[^\s\n]+)?)/
  )

  const result: React.ReactNode[] = []
  let cardBuffer = ""

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === undefined) continue

    const applyMatch = part.match(
      /^APPLY_NOW:(https?:\/\/[^\s]+?)(?:\s+DOWNLOAD:(https?:\/\/[^\s]+))?$/
    )

    if (applyMatch) {
      // Render accumulated content + this APPLY_NOW as a benefit card
      result.push(
        <BenefitCard
          key={i}
          content={cardBuffer}
          applyUrl={applyMatch[1]}
          downloadUrl={applyMatch[2]}
          onKnowMore={onKnowMore}
          lang={lang}
        />
      )
      cardBuffer = ""
    } else {
      cardBuffer += part
    }
  }

  // Remaining text (e.g. closing disclaimer before we removed it, or standalone answers)
  if (cardBuffer.trim()) {
    result.push(
      <AgentMarkdown key="trailing" text={cardBuffer} onKnowMore={onKnowMore} lang={lang} />
    )
  }

  return result
}

// ── Component ─────────────────────────────────────────────────────────
export default function ChatMessage({ message, citizenId, onAction, onSendMessage, dataTour }: Props) {
  const { lang } = useLang()
  const tr = t(lang)
  const [flagged, setFlagged] = useState(false)

  if (!message.content && message.role === "assistant") return null

  const isAgent = message.role === "assistant"

  const handleFlag = async () => {
    setFlagged(true)
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ citizenId, messageId: message.id, type: "wrong-info" }),
    }).catch(() => {})
  }

  const handleKnowMore = (docId: string) => {
    const docName = formatDocName(docId)
    onSendMessage?.(
      `Tell me about the document: ${docName}. What is it, where do I get it if I don't have it, and how long does it take?`
    )
  }

  return (
    <div
      className={`flex ${isAgent ? "justify-start" : "justify-end"} group animate-msg-in`}
      data-tour={dataTour}
    >
      <div className={`max-w-[85%] ${isAgent ? "space-y-2" : ""}`}>
        {isAgent && (
          <div className="text-[11px] text-gray-400 px-1 mb-1">{tr.chat.agentName}</div>
        )}

        <div
          className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isAgent
              ? "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
              : "bg-[#185FA5] text-white rounded-tr-sm"
          }`}
          style={isAgent ? { borderLeft: "3px solid #E6F1FB" } : {}}
        >
          {isAgent
            ? renderContent(message.content, lang, handleKnowMore)
            : <p className="whitespace-pre-wrap">{message.content}</p>
          }

          {isAgent && (
            <button onClick={handleFlag} title={tr.chat.flagTooltip}
              className={`absolute -bottom-1 -right-1 p-1 rounded-full transition-all ${
                flagged
                  ? "opacity-100 text-red-400 bg-white shadow-sm"
                  : "opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 bg-white shadow-sm"
              }`}>
              <Flag size={10} />
            </button>
          )}
        </div>

        {isAgent && message.actionButtons && message.actionButtons.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {message.actionButtons.map((btn, i) => (
              <button key={i} onClick={() => onAction?.(btn.action)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  btn.variant === "green"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "border border-gray-300 hover:border-[#185FA5] hover:text-[#185FA5] text-gray-600"
                }`}>
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
