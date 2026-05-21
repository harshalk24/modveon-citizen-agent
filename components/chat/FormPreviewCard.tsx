"use client"
import { CheckCircle2, AlertCircle, Minus } from "lucide-react"

export interface FormPreviewData {
  title: string
  agency: string
  fields: {
    label: string
    value: string
    status: "filled" | "missing" | "optional"
    source?: string
  }[]
  submitLabel: string
}

interface Props {
  data: FormPreviewData
  onConfirm: () => void
  onEdit?: (fieldLabel: string) => void
  onCancel?: () => void
  language?: "en" | "es"
  submitted?: boolean
}

export default function FormPreviewCard({ data, onConfirm, onEdit, onCancel, language = "en", submitted }: Props) {
  const hasMissing = data.fields.some(f => f.status === "missing")

  if (submitted) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
        ✅ {language === "es" ? "Formulario enviado" : "Form submitted"}
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-[#FFF7CC] px-4 py-3 flex items-center gap-3 border-b border-yellow-200">
        <div className="w-8 h-8 rounded-lg bg-[#FFC400] flex items-center justify-center text-xs font-bold text-yellow-900">
          {data.agency.slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{data.title}</p>
          <p className="text-xs text-gray-500">{language === "es" ? "Vista previa — revisá antes de enviar" : "Preview — review before submitting"}</p>
        </div>
      </div>

      {/* Fields */}
      <div className="divide-y divide-gray-50">
        {data.fields.map((f, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            {f.status === "filled"   && <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />}
            {f.status === "missing"  && <AlertCircle  size={13} className="text-amber-500 flex-shrink-0" />}
            {f.status === "optional" && <Minus size={13} className="text-gray-300 flex-shrink-0" />}
            <span className="text-xs text-gray-400 w-28 flex-shrink-0">{f.label}</span>
            <span className={`text-sm flex-1 ${f.status === "optional" && !f.value ? "text-gray-300 italic" : "text-gray-800 font-medium"}`}>
              {f.value || (language === "es" ? "Opcional" : "Optional")}
            </span>
            {f.source && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{f.source}</span>}
            {f.status === "missing" && (
              <button onClick={() => onEdit?.(f.label)} className="text-xs text-amber-600 hover:text-amber-700 font-medium ml-auto">
                {language === "es" ? "Agregar →" : "Add →"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
            {language === "es" ? "Cancelar" : "Cancel"}
          </button>
        )}
        <button
          onClick={onConfirm}
          disabled={hasMissing}
          className="flex-1 py-2 text-xs font-semibold rounded-lg bg-[#FFC400] text-yellow-900 hover:bg-[#E5AF00] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {data.submitLabel}
        </button>
      </div>
    </div>
  )
}
