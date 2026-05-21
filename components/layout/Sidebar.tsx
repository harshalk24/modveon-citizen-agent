"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, LayoutDashboard, ListChecks, User, Globe } from "lucide-react"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const navItems = [
  { key: "chat", href: "/chat", icon: MessageSquare },
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "plan", href: "/plan", icon: ListChecks },
  { key: "profile", href: "/profile", icon: User },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { lang, toggle } = useLang()
  const { citizen } = useCitizen()
  const tr = t(lang)

  if (pathname === "/" || pathname.startsWith("/onboarding")) return null

  const contextPills = [
    citizen?.profile.lifeEvent ? tr.contextPills[citizen.profile.lifeEvent as keyof typeof tr.contextPills] : null,
    citizen?.profile.employment && citizen.profile.employment !== "any"
      ? tr.contextPills[citizen.profile.employment as keyof typeof tr.contextPills]
      : null,
    citizen?.profile.country ? "El Salvador" : null,
  ].filter(Boolean)

  return (
    <aside className="w-[220px] min-h-screen bg-[#1B3A8C] border-r border-[#152D70] flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-white/10">
        <div className="font-semibold text-[15px] text-white">{tr.appName}</div>
        <div className="text-xs text-white/50 mt-0.5">{tr.appSubtitle}</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-3 space-y-0.5">
        {navItems.map(({ key, href, icon: Icon }) => {
          const label = tr.nav[key as keyof typeof tr.nav]
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "border-l-[3px] border-white bg-white/20 text-white font-semibold -ml-[3px] pl-[calc(0.75rem+3px)]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: language toggle + user context */}
      <div className="px-3 pb-5 space-y-3">
        {/* Language toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors border border-white/20"
        >
          <Globe size={13} />
          {tr.common.langToggle}
        </button>

        {/* User context */}
        {citizen && (
          <div className="px-3 py-2 rounded-lg bg-white/10">
            <div className="text-xs font-medium text-white">
              {citizen.profile.firstName} · {citizen.profile.country === "SV" ? "San Salvador" : citizen.profile.country}
            </div>
            {contextPills.length > 0 && (
              <div className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                {contextPills.join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
