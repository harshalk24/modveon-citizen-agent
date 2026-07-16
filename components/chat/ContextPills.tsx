"use client"

import { useLang } from "@/contexts/LanguageContext"
import { t } from "@/lib/i18n"
import { CitizenContextData } from "@/types/context"

export default function ContextPills({ citizen }: { citizen: CitizenContextData }) {
  const { lang } = useLang()
  const tr = t(lang)

  // Design handoff (Refined Navy): plain text, no emoji — distinct from the
  // Dashboard/My Plan tag treatments which kept emoji (that section of the
  // mock didn't specify otherwise; this one explicitly does).
  const pills = [
    citizen.profile.lifeEvent
      ? tr.contextPills[citizen.profile.lifeEvent as keyof typeof tr.contextPills]
      : null,
    citizen.profile.employment && citizen.profile.employment !== "unknown"
      ? tr.contextPills[citizen.profile.employment as keyof typeof tr.contextPills]
      : null,
    citizen.profile.country ? (citizen.profile.country === "SV" ? "El Salvador" : citizen.profile.country) : null,
  ].filter(Boolean) as string[]

  if (pills.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-[34px] py-3.5 border-b border-ca-surface-hairline bg-white overflow-x-auto">
      {pills.map((label, i) => (
        <span
          key={i}
          className="flex-shrink-0 text-[12.5px] font-medium px-2.5 py-1 rounded-full bg-ca-pill border border-ca-pill-border text-ca-pill-text whitespace-nowrap"
        >
          {label}
        </span>
      ))}
    </div>
  )
}
