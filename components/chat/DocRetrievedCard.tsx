"use client"
import { CheckCircle2, ShieldCheck } from "lucide-react"

export interface DocRetrievedData {
  docName: string
  source: string
  fields: { key: string; value: string }[]
  verified: boolean
}

interface Props {
  data: DocRetrievedData
  language?: "en" | "es"
}

export default function DocRetrievedCard({ data, language = "en" }: Props) {
  return (
    <div className="border-l-4 border-emerald-400 bg-emerald-50 rounded-r-xl p-3 my-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">
            {language === "es" ? "Recuperado:" : "Retrieved:"} {data.docName}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-emerald-600">
          {data.verified && <><ShieldCheck size={11} />{language === "es" ? "Verificado" : "Verified"}</>}
          <span className="text-emerald-500 ml-1">· {data.source}</span>
        </div>
      </div>
      <div className="border-t border-emerald-200 pt-2 space-y-1">
        {data.fields.map((f, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-emerald-600 font-medium w-28 flex-shrink-0">{f.key}</span>
            <span className="font-mono text-gray-700">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
