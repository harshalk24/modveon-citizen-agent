"use client"

import { useLang } from "@/contexts/LanguageContext"
import { t } from "@/lib/i18n"
import { CitizenContextData } from "@/types/context"

const LIFE_EVENT_EMOJI: Record<string, string> = {
  "new-baby": "🛒",
  "job-loss": "💼",
  "start-business": "🏪",
}

export default function ContextPills({ citizen }: { citizen: CitizenContextData }) {
  const { lang } = useLang()
  const tr = t(lang)

  const pills = [
    citizen.profile.lifeEvent
      ? { emoji: LIFE_EVENT_EMOJI[citizen.profile.lifeEvent] || "📋", label: tr.contextPills[citizen.profile.lifeEvent as keyof typeof tr.contextPills] }
      : null,
    citizen.profile.employment && citizen.profile.employment !== "any"
      ? { emoji: "💼", label: tr.contextPills[citizen.profile.employment as keyof typeof tr.contextPills] }
      : null,
    citizen.profile.country ? { emoji: "📍", label: citizen.profile.country === "SV" ? "El Salvador" : citizen.profile.country } : null,
  ].filter(Boolean) as { emoji: string; label: string }[]

  if (pills.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-gray-100 bg-white overflow-x-auto">
      {pills.map((pill, i) => (
        <span
          key={i}
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap"
        >
          <span>{pill.emoji}</span>
          {pill.label}
        </span>
      ))}
    </div>
  )
}
