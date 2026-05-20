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
    <aside className="w-[220px] min-h-screen bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-gray-100">
        <div className="font-semibold text-[15px] text-gray-900">{tr.appName}</div>
        <div className="text-xs text-gray-400 mt-0.5">{tr.appSubtitle}</div>
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
                  ? "bg-blue-50 text-[#185FA5]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors border border-gray-200"
        >
          <Globe size={13} />
          {tr.common.langToggle}
        </button>

        {/* User context */}
        {citizen && (
          <div className="px-3 py-2 rounded-lg bg-gray-50">
            <div className="text-xs font-medium text-gray-700">
              {citizen.profile.firstName} · {citizen.profile.country === "SV" ? "San Salvador" : citizen.profile.country}
            </div>
            {contextPills.length > 0 && (
              <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                {contextPills.join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
