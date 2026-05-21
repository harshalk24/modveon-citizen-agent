"use client"
import { Pause } from "lucide-react"

export interface ConfirmationData {
  question: string
  options: { label: string; value: string; style: "primary" | "secondary" | "danger" }[]
}

interface Props {
  data: ConfirmationData
  onChoice: (value: string) => void
  language?: "en" | "es"
  resolved?: boolean
}

export default function ConfirmationCard({ data, onChoice, language = "en", resolved }: Props) {
  if (resolved) {
    return <div className="text-xs text-gray-400 italic px-1">{language === "es" ? "Respondido ✓" : "Answered ✓"}</div>
  }

  return (
    <div className="border-l-4 border-[#FFC400] bg-[#FFF7CC] rounded-r-xl p-3 my-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Pause size={13} className="text-yellow-600" />
        <span className="text-xs font-semibold text-yellow-800">{data.question}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.options.map((opt, i) => (
          <button key={i} onClick={() => onChoice(opt.value)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              opt.style === "primary"   ? "bg-[#FFC400] text-yellow-900 hover:bg-[#E5AF00]" :
              opt.style === "danger"    ? "border border-red-400 text-red-600 hover:bg-red-50" :
              "border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
