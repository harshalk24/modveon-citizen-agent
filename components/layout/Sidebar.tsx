"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, LayoutDashboard, ListChecks, User, Globe, Clock, SquarePen } from "lucide-react"
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

// Per-page preview personas + conversation history
const PREVIEW_PERSONAS: Record<string, { name: string; country: string; situation: string }> = {
  "/preview/chat":       { name: "María García",  country: "El Salvador",  situation: "New baby · Employed"           },
  "/preview/kb":         { name: "James Miller",   country: "United States", situation: "Retired · Age 67 · Ohio"     },
  "/preview/navigation": { name: "Priya Kapoor",   country: "United Kingdom", situation: "Opening a food business"    },
  "/preview/plan":       { name: "Priya Kapoor",   country: "United Kingdom", situation: "London Café Action Plan"    },
  "/preview/pagent":     { name: "Sarah Tan",      country: "Singapore",     situation: "New mother · 8 days old baby"},
  "/bermuda/proactive":  { name: "Jordan Blake",    country: "Bermuda",       situation: "Government Job Application"  },
  "/bermuda":            { name: "Marcus Tavares",  country: "Bermuda",       situation: "Standard Work Permit"        },
  "/bermuda/plan":       { name: "Marcus Tavares",  country: "Bermuda",       situation: "Work Permit Arrival Plan"    },
}

const PREVIEW_CONVOS_MAP: Record<string, { id: string; title: string; time: string; active: boolean }[]> = {
  "/preview/chat": [
    { id: "c1", title: "RNPN birth registration",         time: "Just now",    active: true  },
    { id: "c2", title: "Maternity benefit claim",          time: "2 hours ago", active: false },
    { id: "c3", title: "ISSS dependent enrollment",       time: "Yesterday",   active: false },
    { id: "c4", title: "Business registration guide",     time: "3 days ago",  active: false },
    { id: "c5", title: "Poder notarial from L.A.",        time: "Last week",   active: false },
  ],
  "/preview/kb": [
    { id: "c1", title: "Medicare Extra Help eligibility", time: "Just now",    active: true  },
    { id: "c2", title: "SNAP application guidance",       time: "3 days ago",  active: false },
    { id: "c3", title: "Ohio HEAP energy assistance",     time: "Last week",   active: false },
    { id: "c4", title: "Medicare Part D plan review",     time: "2 weeks ago", active: false },
    { id: "c5", title: "Prescription drug coverage",      time: "Last month",  active: false },
  ],
  "/preview/plan": [
    { id: "c1", title: "London café action plan",         time: "Just now",    active: true  },
    { id: "c2", title: "Council food registration",       time: "3 days ago",  active: false },
    { id: "c3", title: "Food hygiene certificate",        time: "Last week",   active: false },
    { id: "c4", title: "Business bank account",           time: "Last week",   active: false },
    { id: "c5", title: "Public liability insurance",      time: "3 days ago",  active: false },
  ],
  "/preview/navigation": [
    { id: "c1", title: "Opening a food business in London", time: "Just now",    active: true  },
    { id: "c2", title: "Council food registration",         time: "3 days ago",  active: false },
    { id: "c3", title: "Food hygiene certificate",          time: "Last week",   active: false },
    { id: "c4", title: "Companies House registration",      time: "2 weeks ago", active: false },
    { id: "c5", title: "Business insurance quotes",         time: "Last month",  active: false },
  ],
  "/preview/pagent": [
    { id: "c1", title: "Baby Bonus + CDA registration",    time: "Just now",    active: true  },
    { id: "c2", title: "Child Development Account setup",   time: "3 days ago",  active: false },
    { id: "c3", title: "Baby Bonus Plus application",       time: "Last week",   active: false },
    { id: "c4", title: "MediSave baby grant",               time: "2 weeks ago", active: false },
    { id: "c5", title: "CHAS healthcare card",              time: "Last month",  active: false },
  ],
  "/bermuda/proactive": [
    { id: "c1", title: "Manager (Operations) application", time: "Just now",    active: true  },
    { id: "c2", title: "Senior Programme Manager role",    time: "2 hours ago", active: false },
    { id: "c3", title: "CV upload and role matching",      time: "Yesterday",   active: false },
    { id: "c4", title: "Work permit eligibility check",    time: "2 days ago",  active: false },
    { id: "c5", title: "Government careers portal guide",  time: "Last week",   active: false },
  ],
  "/bermuda": [
    { id: "c1", title: "Work permit arrival checklist",    time: "Just now",    active: true  },
    { id: "c2", title: "Social Insurance registration",    time: "1 hour ago",  active: false },
    { id: "c3", title: "Health insurance confirmation",    time: "Yesterday",   active: false },
    { id: "c4", title: "PRC eligibility after 20 years",   time: "2 days ago",  active: false },
    { id: "c5", title: "Assessment Number for lease",      time: "Last week",   active: false },
  ],
  "/bermuda/plan": [
    { id: "c1", title: "Work permit arrival checklist",    time: "Just now",    active: true  },
    { id: "c2", title: "Social Insurance registration",    time: "1 hour ago",  active: false },
    { id: "c3", title: "Health insurance confirmation",    time: "Yesterday",   active: false },
    { id: "c4", title: "PRC eligibility after 20 years",   time: "2 days ago",  active: false },
    { id: "c5", title: "Assessment Number for lease",      time: "Last week",   active: false },
  ],
}

export default function Sidebar() {
  const pathname = usePathname()
  const { lang, toggle } = useLang()
  const { citizen, isLoading } = useCitizen()
  const tr = t(lang)
  const [toast, setToast] = useState<string | null>(null)

  if (pathname === "/" || pathname.startsWith("/onboarding")) return null

  const isPreview = pathname.startsWith("/preview") || pathname.startsWith("/bermuda")

  // Resolve per-page preview persona — match exact path first, fallback to prefix
  const previewPersona = isPreview
    ? (PREVIEW_PERSONAS[pathname] ?? Object.entries(PREVIEW_PERSONAS).find(([k]) => pathname.startsWith(k))?.[1] ?? PREVIEW_PERSONAS["/preview/chat"])
    : null
  const previewConvos = isPreview
    ? (PREVIEW_CONVOS_MAP[pathname] ?? Object.entries(PREVIEW_CONVOS_MAP).find(([k]) => pathname.startsWith(k))?.[1] ?? PREVIEW_CONVOS_MAP["/preview/chat"])
    : []

  // Skip employment pill when life event already implies employment status
  const lifeEventImpliesUnemployed = citizen?.profile.lifeEvent === "job-loss"
  const contextPills = [
    citizen?.profile.lifeEvent
      ? tr.contextPills[citizen.profile.lifeEvent as keyof typeof tr.contextPills]
      : null,
    !lifeEventImpliesUnemployed && citizen?.profile.employment && citizen.profile.employment !== "unknown"
      ? tr.contextPills[citizen.profile.employment as keyof typeof tr.contextPills]
      : null,
    citizen?.profile.country ? (citizen.profile.country === "SV" ? "El Salvador" : citizen.profile.country) : null,
  ].filter(Boolean) as string[]

  // Profile data: mock for preview, real for MVP
  const profileName    = isPreview ? previewPersona!.name    : citizen?.profile.firstName
  const profileInitial = (profileName?.[0] || "?").toUpperCase()
  const profileSub     = isPreview
    ? previewPersona!.situation
    : contextPills.join(" · ")

  const showConvToast = () => {
    setToast("This conversation is read-only in preview mode")
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <>
      <aside className="w-[220px] h-screen bg-[#1B3A8C] border-r border-[#152D70] flex flex-col flex-shrink-0">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-[15px] text-white">{tr.appName}</div>
              <div className="text-xs text-white/50 mt-0.5">{tr.appSubtitle}</div>
            </div>
            {/* New conversation button — hard reload for preview (resets React state) */}
            {isPreview ? (
              <a href={pathname} title="New conversation"
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0">
                <SquarePen size={15} className="text-white/70" />
              </a>
            ) : (
              <Link href="/chat" title="New conversation"
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0">
                <SquarePen size={15} className="text-white/70" />
              </Link>
            )}
          </div>
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

          {/* Conversations — all preview pages */}
          {isPreview && previewConvos.length > 0 && (
            <div className="pt-4">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-3 mb-2">
                Conversations
              </p>
              {previewConvos.map(conv => (
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
          {!isPreview && (
            <button
              onClick={toggle}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors border border-white/20"
            >
              <Globe size={13} />
              {tr.common.langToggle}
            </button>
          )}

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
