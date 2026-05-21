"use client"

import { useState, useEffect } from "react"
import {
  CheckCircle2, Loader2, Circle, AlertCircle,
  FileText, Minus, ChevronDown, ChevronUp, ShieldCheck, Phone,
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

/* ── Activity card — Claude-style collapsible steps ─────────── */
function ActivityCard({ msg }: { msg: PreviewMessage }) {
  const [expanded, setExpanded]       = useState(true)
  const [openSteps, setOpenSteps]     = useState<Set<string>>(new Set())
  const acts   = msg.activities ?? []
  const done   = acts.filter(a => a.status === "done").length
  const running = acts.find(a => a.status === "running")

  // Auto-collapse card 1.5s after all done
  useEffect(() => {
    if (msg.isComplete) {
      const t = setTimeout(() => setExpanded(false), 1500)
      return () => clearTimeout(t)
    }
  }, [msg.isComplete])

  const toggleStep = (id: string) =>
    setOpenSteps(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white w-full shadow-sm">
      {/* Card header */}
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
              ? `${done} steps completed`
              : running ? `Working — ${running.label}` : "Working…"}
          </span>
        </div>
        {expanded
          ? <ChevronUp size={13} className="text-gray-400" />
          : <ChevronDown size={13} className="text-gray-400" />}
      </button>

      {/* Step list */}
      {expanded && (
        <div className="divide-y divide-gray-50">
          {acts.map(a => {
            const hasDetail  = !!a.detail
            const isOpen     = openSteps.has(a.id)
            return (
              <div key={a.id}>
                <button
                  onClick={() => hasDetail && toggleStep(a.id)}
                  className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors
                    ${hasDetail ? "cursor-pointer hover:bg-gray-50" : "cursor-default"}`}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {a.status === "running" && <Loader2 size={13} className="animate-spin text-yellow-500" />}
                    {a.status === "done"    && <CheckCircle2 size={13} className="text-emerald-500" />}
                    {a.status === "waiting" && <Circle size={13} className="text-gray-300" />}
                    {a.status === "failed"  && <AlertCircle size={13} className="text-red-500" />}
                  </div>

                  {/* Label */}
                  <span className={`flex-1 text-xs leading-snug ${
                    a.status === "done"    ? "text-gray-500"           :
                    a.status === "running" ? "text-gray-800 font-medium" :
                    a.status === "failed"  ? "text-red-600"            :
                    "text-gray-400"
                  }`}>
                    {a.label}
                  </span>

                  {/* Expand chevron for steps with details */}
                  {hasDetail && (
                    isOpen
                      ? <ChevronUp   size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      : <ChevronDown size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  )}
                </button>

                {/* Collapsible detail */}
                {hasDetail && isOpen && (
                  <div className="px-4 pb-3 pl-10">
                    <p className="text-[11px] text-gray-600 font-mono bg-gray-50 rounded-lg px-3 py-2 leading-relaxed border border-gray-100">
                      {a.detail}
                    </p>
                  </div>
                )}
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
