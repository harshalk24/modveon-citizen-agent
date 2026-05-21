"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, LayoutDashboard, ListChecks, User, Globe, Clock } from "lucide-react"
import { useState } from "react"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const navItems = [
  { key: "chat",      href: "/chat",      icon: MessageSquare    },
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard  },
  { key: "plan",      href: "/plan",      icon: ListChecks       },
  { key: "profile",   href: "/profile",   icon: User             },
]

const PREVIEW_CONVOS = [
  { id: "c1", title: "RNPN birth registration",         time: "Just now",    active: true  },
  { id: "c2", title: "Maternity benefit claim",          time: "2 hours ago", active: false },
  { id: "c3", title: "ISSS dependent enrollment",       time: "Yesterday",   active: false },
  { id: "c4", title: "Business registration guide",     time: "3 days ago",  active: false },
  { id: "c5", title: "Poder notarial from Los Angeles", time: "Last week",   active: false },
]

const PREVIEW_MOCK = {
  name: "María García",
  country: "El Salvador",
  situation: "New baby",
}

export default function Sidebar() {
  const pathname = usePathname()
  const { lang, toggle } = useLang()
  const { citizen, isLoading } = useCitizen()
  const tr = t(lang)
  const [toast, setToast] = useState<string | null>(null)

  if (pathname === "/" || pathname.startsWith("/onboarding")) return null

  const isPreview     = pathname.startsWith("/preview")
  const isPreviewChat = pathname === "/preview/chat"

  // Skip employment pill when life event already implies employment status
  const lifeEventImpliesUnemployed = citizen?.profile.lifeEvent === "job-loss"
  const contextPills = [
    citizen?.profile.lifeEvent
      ? tr.contextPills[citizen.profile.lifeEvent as keyof typeof tr.contextPills]
      : null,
    !lifeEventImpliesUnemployed && citizen?.profile.employment && citizen.profile.employment !== "any"
      ? tr.contextPills[citizen.profile.employment as keyof typeof tr.contextPills]
      : null,
    citizen?.profile.country ? "El Salvador" : null,
  ].filter(Boolean) as string[]

  // Profile data: mock for preview, real for MVP
  const profileName    = isPreview ? PREVIEW_MOCK.name    : citizen?.profile.firstName
  const profileInitial = (profileName?.[0] || "?").toUpperCase()
  const profileSub     = isPreview
    ? `${PREVIEW_MOCK.country} · ${PREVIEW_MOCK.situation}`
    : contextPills.join(" · ")

  const showConvToast = () => {
    setToast("This conversation is read-only in preview mode")
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <>
      <aside className="w-[220px] h-screen bg-[#1B3A8C] border-r border-[#152D70] flex flex-col flex-shrink-0">

        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
          <div className="font-semibold text-[15px] text-white">{tr.appName}</div>
          <div className="text-xs text-white/50 mt-0.5">{tr.appSubtitle}</div>
        </div>

        {/* Scrollable middle: nav + conversations */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {navItems.map(({ key, href, icon: Icon }) => {
            const label  = tr.nav[key as keyof typeof tr.nav]
            const active = !isPreview && pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "border-l-[3px] border-yellow-400 bg-white/20 text-white font-semibold -ml-[3px] pl-[calc(0.75rem+3px)]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}

          {/* Conversations — preview/chat only */}
          {isPreviewChat && (
            <div className="pt-4">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-3 mb-2">
                Conversations
              </p>
              {PREVIEW_CONVOS.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => !conv.active && showConvToast()}
                  className={cn(
                    "w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors border-l-2",
                    conv.active
                      ? "bg-yellow-400/10 border-yellow-400"
                      : "border-transparent hover:bg-white/8 opacity-65 hover:opacity-90"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${conv.active ? "text-yellow-300" : "text-white"}`}>
                      {conv.title}
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
                      <Clock size={8} className="flex-shrink-0" />
                      {conv.time}
                    </p>
                  </div>
                  {conv.active && (
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: language toggle + profile */}
        <div className="flex-shrink-0 px-3 pb-4 pt-3 border-t border-white/10 space-y-2.5">
          <button
            onClick={toggle}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors border border-white/20"
          >
            <Globe size={13} />
            {tr.common.langToggle}
          </button>

          {/* Avatar-style profile card */}
          {(isPreview || citizen) ? (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/10">
              <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-yellow-900">{profileInitial}</span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{profileName || "—"}</div>
                {profileSub && (
                  <div className="text-[10px] text-white/50 mt-0.5 leading-tight">{profileSub}</div>
                )}
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/10">
              <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <div className="h-2.5 w-20 bg-white/20 rounded animate-pulse mb-1.5" />
                <div className="h-2 w-28 bg-white/10 rounded animate-pulse" />
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </>
  )
}
