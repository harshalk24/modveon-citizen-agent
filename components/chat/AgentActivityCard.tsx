"use client"
import { useState, useEffect } from "react"
import { Loader2, CheckCircle2, AlertCircle, Circle, ChevronDown, ChevronUp, Info } from "lucide-react"

export interface AgentActivity {
  id: string
  label: string
  status: "running" | "done" | "failed" | "waiting"
  detail?: string
  expandedContent?: string
}

interface Props {
  activities: AgentActivity[]
  isComplete: boolean
  language?: "en" | "es"
}

export default function AgentActivityCard({ activities, isComplete, language = "en" }: Props) {
  const [expanded, setExpanded] = useState(true)

  // Auto-collapse 1.5s after all complete
  useEffect(() => {
    if (isComplete) {
      const t = setTimeout(() => setExpanded(false), 1500)
      return () => clearTimeout(t)
    }
  }, [isComplete])

  const currentActivity = activities.find(a => a.status === "running")
  const doneCount = activities.filter(a => a.status === "done").length

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 my-1">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isComplete
            ? <CheckCircle2 size={14} className="text-emerald-500" />
            : <Loader2 size={14} className="animate-spin text-[#FFC400]" />
          }
          <span className="text-xs font-medium text-gray-700">
            {isComplete
              ? (language === "es" ? `${doneCount} pasos completados` : `${doneCount} steps completed`)
              : (language === "es" ? `Trabajando — ${currentActivity?.label || "..."}` : `Working — ${currentActivity?.label || "..."}`)}
          </span>
        </div>
        {expanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
      </button>

      {/* Activity list */}
      {expanded && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {activities.map(a => (
            <div key={a.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                {a.status === "running"   && <Loader2 size={12} className="animate-spin text-[#FFC400] flex-shrink-0" />}
                {a.status === "done"      && <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />}
                {a.status === "waiting"   && <Circle size={12} className="text-gray-300 flex-shrink-0" />}
                {a.status === "failed"    && <AlertCircle size={12} className="text-red-500 flex-shrink-0" />}
                <span className={`text-xs ${
                  a.status === "done"    ? "text-gray-400 line-through" :
                  a.status === "running" ? "text-gray-800 font-semibold" :
                  a.status === "failed"  ? "text-red-600" :
                  "text-gray-400"
                }`}>{a.label}</span>
              </div>
              {a.expandedContent && (
                <p className="mt-1 text-[11px] text-gray-500 pl-5 leading-relaxed">{a.expandedContent}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
