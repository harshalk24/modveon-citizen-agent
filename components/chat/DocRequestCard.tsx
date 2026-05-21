"use client"
import { useState } from "react"
import { FileText, Upload, Pencil } from "lucide-react"

export interface DocRequestData {
  docName: string
  docDescription: string
  options: { label: string; action: "upload" | "type" | "skip" }[]
}

interface Props {
  data: DocRequestData
  onAction: (action: string, value?: string) => void
  language?: "en" | "es"
  resolved?: boolean
}

export default function DocRequestCard({ data, onAction, language = "en", resolved }: Props) {
  const [showInlineInput, setShowInlineInput] = useState(false)
  const [inlineValue, setInlineValue] = useState("")

  if (resolved) {
    return (
      <div className="border-l-4 border-[#1B3A8C] bg-blue-50 rounded-r-xl p-3 text-xs text-blue-700 font-medium">
        ✓ {data.docName} {language === "es" ? "proporcionado" : "provided"}
      </div>
    )
  }

  const submitInline = () => {
    if (!inlineValue.trim()) return
    onAction("type", inlineValue.trim())
    setShowInlineInput(false)
    setInlineValue("")
  }

  return (
    <div className="border-l-4 border-[#1B3A8C] bg-blue-50 rounded-r-xl p-3 my-1">
      <div className="flex items-center gap-1.5 mb-1">
        <FileText size={13} className="text-[#1B3A8C]" />
        <span className="text-xs font-semibold text-[#1B3A8C]">
          {language === "es" ? "Necesito:" : "I need:"} {data.docName}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-3">{data.docDescription}</p>

      {/* Inline text input — shown when user clicks "Enter" option */}
      {showInlineInput ? (
        <div className="flex gap-2 mt-1 mb-2">
          <input
            autoFocus
            type="text"
            value={inlineValue}
            onChange={e => setInlineValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitInline() }}
            placeholder={language === "es" ? `Escribí ${data.docName}…` : `Enter ${data.docName}…`}
            className="flex-1 text-sm border border-blue-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#FFC400] bg-white"
          />
          <button
            onClick={submitInline}
            disabled={!inlineValue.trim()}
            className="px-3 py-1.5 text-xs font-semibold bg-[#FFC400] text-yellow-900 rounded-lg hover:bg-[#E5AF00] disabled:opacity-40 transition-colors"
          >
            ✓
          </button>
          <button
            onClick={() => { setShowInlineInput(false); setInlineValue("") }}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.options.map((opt, i) => {
            if (opt.action === "type") return (
              <button key={i} onClick={() => setShowInlineInput(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#1B3A8C] text-[#1B3A8C] rounded-lg hover:bg-blue-100 transition-colors">
                <Pencil size={11} />{opt.label}
              </button>
            )
            if (opt.action === "skip") return (
              <button key={i} onClick={() => onAction("skip")}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2">
                {opt.label}
              </button>
            )
            return (
              <button key={i} onClick={() => onAction("upload")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#FFC400] text-yellow-900 rounded-lg hover:bg-[#E5AF00] transition-colors">
                <Upload size={11} />{opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
