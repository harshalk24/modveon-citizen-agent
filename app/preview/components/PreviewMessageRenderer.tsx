"use client"

import { useState, useEffect } from "react"
import {
  CheckCircle2, Loader2, Circle, AlertCircle,
  FileText, Minus, ChevronDown, ChevronUp, ShieldCheck, Phone, ArrowRight,
} from "lucide-react"
import type { PreviewMessage, PreviewActivity } from "../types"

/* ── Minimal markdown: **bold** and \n newlines ─────────────── */
function Md({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
        if (p === "\n") return <br key={i} />
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

/* ── Activity card — task-by-task progress with highlights ──── */
function ActivityCard({ msg }: { msg: PreviewMessage }) {
  const [expanded, setExpanded] = useState(true)
  const acts        = msg.activities ?? []
  const doneCount   = acts.filter(a => a.status === "done").length
  const total       = acts.length
  const running     = acts.find(a => a.status === "running")
  const firstWaiting = acts.find(a => a.status === "waiting")

  useEffect(() => {
    if (msg.isComplete) {
      const t = setTimeout(() => setExpanded(false), 2000)
      return () => clearTimeout(t)
    }
  }, [msg.isComplete])

  return (
    <div className="rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm w-full">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-emerald-400 transition-all duration-700 ease-out"
          style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
        />
      </div>

      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {msg.isComplete
            ? <CheckCircle2 size={15} className="text-emerald-500" />
            : <Loader2 size={15} className="animate-spin text-yellow-500" />}
          <span className="text-sm font-medium text-gray-800">
            {msg.isComplete
              ? `All ${doneCount} steps completed`
              : running ? running.label : "Working…"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 tabular-nums">{doneCount}/{total}</span>
          {expanded
            ? <ChevronUp   size={13} className="text-gray-400" />
            : <ChevronDown size={13} className="text-gray-400" />}
        </div>
      </button>

      {/* Step list */}
      {expanded && (
        <div>
          {acts.map(a => {
            const isNextUp = !msg.isComplete && a.status === "waiting" && a.id === firstWaiting?.id
            const rowBg =
              a.status === "running" ? "bg-amber-50"       :
              a.status === "done"    ? "bg-emerald-50/40"  :
              isNextUp               ? "bg-blue-50/30"     : ""

            return (
              <div key={a.id} className={`px-4 py-2.5 border-b border-gray-50 last:border-0 ${rowBg}`}>
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {a.status === "running" && <Loader2      size={13} className="animate-spin text-amber-500" />}
                    {a.status === "done"    && <CheckCircle2 size={13} className="text-emerald-500" />}
                    {a.status === "waiting" && (
                      <Circle size={13} className={isNextUp ? "text-blue-400" : "text-gray-200"} />
                    )}
                    {a.status === "failed"  && <AlertCircle  size={13} className="text-red-500" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs leading-snug ${
                        a.status === "done"    ? "text-emerald-700"          :
                        a.status === "running" ? "text-gray-900 font-semibold" :
                        isNextUp               ? "text-blue-700 font-medium"  :
                        "text-gray-300"
                      }`}>
                        {a.label}
                      </span>

                      {a.status === "running" && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                          In progress
                        </span>
                      )}
                      {a.status === "done" && (
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                          Done ✓
                        </span>
                      )}
                      {isNextUp && (
                        <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                          Next →
                        </span>
                      )}
                    </div>

                    {/* Detail shown inline for done + running */}
                    {a.detail && (a.status === "done" || a.status === "running") && (
                      <p className={`text-[10px] font-mono mt-1 rounded px-2 py-1 leading-relaxed ${
                        a.status === "done"
                          ? "text-emerald-600/80 bg-emerald-50/60 border border-emerald-100"
                          : "text-gray-500 bg-white border border-gray-100"
                      }`}>
                        {a.detail}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Props ──────────────────────────────────────────────────── */
interface Props {
  message: PreviewMessage
  onAction: (value: string) => void
}

/* ── Main renderer ──────────────────────────────────────────── */
export default function PreviewMessageRenderer({ message, onAction }: Props) {
  const { type } = message

  /* assistant / status ─────────────────────────────────────── */
  if (type === "assistant" || type === "status") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Assist</p>
          <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm text-gray-800 leading-relaxed">
            {message.content && <Md text={message.content} />}
          </div>
        </div>
      </div>
    )
  }

  /* user ───────────────────────────────────────────────────── */
  if (type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-yellow-400 text-yellow-900 rounded-2xl rounded-tr-sm px-4 py-3 text-sm font-medium">
          {message.content}
        </div>
      </div>
    )
  }

  /* activity ───────────────────────────────────────────────── */
  if (type === "activity") {
    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[90%]">
          <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Assist</p>
          <ActivityCard msg={message} />
        </div>
      </div>
    )
  }

  /* doc-retrieved ──────────────────────────────────────────── */
  if (type === "doc-retrieved") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] w-full">
          <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Assist</p>
          <div className="border-l-4 border-emerald-400 bg-emerald-50 rounded-r-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700">
                  Retrieved: {message.docName}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                <ShieldCheck size={11} />Verified
              </div>
            </div>
            <div className="border-t border-emerald-200 pt-2 space-y-1">
              {(message.docData ?? []).map((f, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-emerald-700 font-medium w-32 flex-shrink-0">{f.key}</span>
                  <span className="font-mono text-gray-700">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* doc-request ────────────────────────────────────────────── */
  if (type === "doc-request") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Assist</p>
          <div className="border-l-4 border-blue-400 bg-blue-50 rounded-r-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText size={13} className="text-blue-700" />
              <span className="text-xs font-semibold text-blue-700">
                I need: {message.docName}
              </span>
            </div>
            {message.content && (
              <p className="text-xs text-gray-700 leading-relaxed">
                <Md text={message.content} />
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* form-preview ───────────────────────────────────────────── */
  if (type === "form-preview") {
    const fields = message.formFields ?? []
    const hasMissing = fields.some(f => f.status === "missing")
    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[90%]">
          <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Assist</p>
          {message.content && (
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm text-gray-800 leading-relaxed mb-2">
              <Md text={message.content} />
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-yellow-50 px-4 py-3 flex items-center gap-3 border-b border-yellow-100">
              <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center text-xs font-bold text-yellow-900">RN</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Birth Registration — RNPN</p>
                <p className="text-xs text-gray-500">Preview — review before submitting</p>
              </div>
            </div>
            {/* Fields */}
            <div className="divide-y divide-gray-50">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  {f.status === "filled"   && <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />}
                  {f.status === "missing"  && <AlertCircle  size={13} className="text-amber-500 flex-shrink-0" />}
                  {f.status === "optional" && <Minus size={13} className="text-gray-300 flex-shrink-0" />}
                  <span className="text-xs text-gray-400 w-32 flex-shrink-0">{f.label}</span>
                  <span className={`text-sm flex-1 ${f.status === "optional" && !f.value ? "text-gray-300 italic" : "text-gray-800 font-medium"}`}>
                    {f.value || "Optional"}
                  </span>
                  {f.source && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{f.source}</span>}
                </div>
              ))}
            </div>
            {/* Buttons */}
            {message.confirmOptions && (
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex gap-2">
                {message.confirmOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => onAction(opt.value)}
                    disabled={opt.primary && hasMissing}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                      ${opt.primary
                        ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-500"
                        : "border border-gray-300 text-gray-600 hover:bg-gray-100"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* confirmation ───────────────────────────────────────────── */
  if (type === "confirmation") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Assist</p>
          <div className="border-l-4 border-yellow-400 bg-yellow-50 rounded-r-xl p-3">
            {message.content && (
              <p className="text-sm text-gray-800 mb-3 leading-relaxed">
                <Md text={message.content} />
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(message.confirmOptions ?? []).map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onAction(opt.value)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors
                    ${opt.primary
                      ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-500"
                      : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* whatsapp-mock ──────────────────────────────────────────── */
  if (type === "whatsapp-mock") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Assist</p>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-green-600 px-3 py-2 flex items-center gap-2">
              <Phone size={12} className="text-white" />
              <span className="text-xs font-semibold text-white">WhatsApp notification</span>
            </div>
            <div className="px-3 py-3">
              <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed font-mono bg-gray-50 rounded-lg p-2.5">
                {message.whatsappText}
              </p>
            </div>
            <div className="px-3 pb-2">
              <p className="text-[10px] text-gray-400 italic">
                This is a preview — not a real WhatsApp message.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
