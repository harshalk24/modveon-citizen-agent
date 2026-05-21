"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import { lookupServices, services as kbServices } from "@/lib/kb"
import { Gift, ListChecks, Calendar, MessageSquare, AlertCircle, ChevronRight, Loader2 } from "lucide-react"

function getDaysLeft(dueDate: string) {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

const safeDivide = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100)

export default function DashboardPage() {
  const router = useRouter()
  const { lang } = useLang()
  const { citizen, isLoading, refresh } = useCitizen()
  const tr = t(lang)

  const hour = new Date().getHours()

  // Refresh citizen data on mount and whenever the tab regains focus.
  // This ensures the dashboard shows the latest entitlements/plan data
  // after the user has been chatting (which saves to DB asynchronously).
  useEffect(() => {
    refresh()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[#185FA5]" />
      </div>
    )
  }

  // Resolve lifeEvent — prefer DB, fall back to localStorage signal captured during chat
  const resolvedLifeEvent = citizen?.profile.lifeEvent ||
    (typeof window !== "undefined" ? localStorage.getItem("ca_detected_life_event") : "") || ""
  const resolvedEmployment = citizen?.profile.employment ||
    (typeof window !== "undefined" ? localStorage.getItem("ca_detected_employment") : "") || "any"
  const resolvedCountry = citizen?.profile.country || "SV"

  // Empty state — no life event detected yet
  if (!resolvedLifeEvent) {
    return <EmptyDashboard tr={tr} lang={lang} router={router} firstName={citizen?.profile.firstName} hour={hour} />
  }

  const contextServices = lookupServices({
    country: resolvedCountry,
    lifeEvent: resolvedLifeEvent,
    employment: resolvedEmployment,
  })

  const entitlements = citizen?.entitlements || []
  const claimedCount = entitlements.filter(e => e.status === "received").length
  const planSteps = citizen?.planSteps || []
  const doneSteps = planSteps.filter(s => s.status === "done")
  const nextStep = planSteps.find(s => s.status !== "done")

  const deadlines = citizen?.deadlines || []
  const activeDeadlines = deadlines
    .filter(d => !d.completed)
    .map(d => ({ ...d, daysLeft: getDaysLeft(d.dueDate) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
  const metDeadlines = deadlines.filter(d => d.completed)

  // Synthesize deadlines from plan steps that have deadlineDays but no matching DB deadline yet.
  // Use citizen.lastUpdated as the life-event baseline for computing the due date.
  const planDerivedDeadlines = planSteps
    .filter(s => {
      if (s.status === "done") return false
      const kbSvc = kbServices.find(k => k.id === s.serviceId)
      if (!kbSvc?.deadlineDays) return false
      return !deadlines.some(d => d.serviceId === s.serviceId)
    })
    .map(s => {
      const kbSvc = kbServices.find(k => k.id === s.serviceId)!
      const base = new Date(citizen?.lastUpdated || Date.now())
      const dueDate = new Date(base.getTime() + kbSvc.deadlineDays! * 24 * 60 * 60 * 1000)
      return {
        serviceId:  s.serviceId,
        title:      s.serviceName,
        titleEs:    s.serviceNameEs,
        dueDate:    dueDate.toISOString(),
        completed:  false,
        daysLeft:   getDaysLeft(dueDate.toISOString()),
        fromPlan:   true as const,
      }
    })
    .filter(d => d.daysLeft > 0)

  // Merge DB deadlines + plan-derived deadlines, sorted by urgency
  const allDisplayDeadlines = [...activeDeadlines, ...planDerivedDeadlines]
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const urgentCount = allDisplayDeadlines.filter(d => d.daysLeft <= 30).length

  // Total value estimate
  const totalValueMonthly = entitlements.reduce((sum, e) => {
    const kb = kbServices.find(s => s.id === e.serviceId)
    if (!kb?.amount) return sum
    const match = kb.amount.match(/\$?([\d,]+)/)
    if (!match) return sum
    const num = parseInt(match[1].replace(",", ""))
    if (kb.amount.includes("/mes") || kb.amount.includes("/mo")) return sum + num
    return sum
  }, 0)

  const deadlineColor = (days: number) => {
    if (days <= 7) return "border-red-500 bg-red-50"
    if (days <= 30) return "border-amber-400 bg-amber-50"
    return "border-gray-200 bg-white"
  }

  const deadlineTitleColor = (days: number) => {
    if (days <= 7) return "text-red-700"
    if (days <= 30) return "text-amber-700"
    return "text-gray-700"
  }

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {tr.dashboard.greeting(citizen?.profile.firstName || (lang === "es" ? "ahí" : "there"), hour)}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{tr.dashboard.subtitle}</p>
          </div>
          {urgentCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1.5 rounded-full bg-red-50 text-red-600 flex items-center gap-1.5">
              <AlertCircle size={12} />
              {tr.dashboard.urgentBadge(urgentCount)}
            </span>
          )}
        </div>

        {/* Context pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { emoji: "🛒", label: tr.contextPills[resolvedLifeEvent as keyof typeof tr.contextPills] || resolvedLifeEvent },
            resolvedEmployment !== "any" && { emoji: "💼", label: tr.contextPills[resolvedEmployment as keyof typeof tr.contextPills] || resolvedEmployment },
            { emoji: "📍", label: "El Salvador" },
          ].filter(Boolean).map((pill: any, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600">
              {pill.emoji} {pill.label}
            </span>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 py-4">
        {/* LEFT — Progress */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{tr.dashboard.progress.title}</h2>

          {/* Benefits claimed */}
          <ProgressRow
            icon={<Gift size={14} className="text-[#185FA5]" />}
            label={tr.dashboard.progress.benefitsClaimed}
            sub={tr.dashboard.progress.benefitsUnclaimed(contextServices.length - claimedCount)}
            value={claimedCount}
            total={contextServices.length}
            color="bg-[#185FA5]"
          />

          {/* Plan steps */}
          <ProgressRow
            icon={<ListChecks size={14} className="text-emerald-600" />}
            label={tr.dashboard.progress.planSteps}
            sub={planSteps.length === 0 ? (lang === "es" ? "Aún no hay plan" : "No plan yet") : nextStep ? tr.dashboard.progress.nextStep(nextStep.serviceName || nextStep.serviceId) : ""}
            value={doneSteps.length}
            total={planSteps.length || 1}
            color="bg-emerald-500"
          />

          {/* Deadlines met */}
          <ProgressRow
            icon={<Calendar size={14} className="text-amber-500" />}
            label={tr.dashboard.progress.deadlinesMet}
            sub={tr.dashboard.progress.deadlinesComingUp(allDisplayDeadlines.length)}
            value={metDeadlines.length}
            total={deadlines.length + planDerivedDeadlines.length}
            color="bg-amber-500"
          />

          {/* Total value */}
          {totalValueMonthly > 0 ? (
            <div className="pt-2 border-t border-gray-50">
              <p className="text-xs text-gray-500">{tr.dashboard.progress.totalValue}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">${totalValueMonthly.toLocaleString()}<span className="text-sm font-normal text-gray-400">/mo</span></p>
              <p className="text-xs text-gray-400">{tr.dashboard.progress.totalValueSub}</p>
            </div>
          ) : entitlements.length === 0 && (
            <div className="pt-2 border-t border-gray-50">
              <p className="text-xs text-gray-400 text-center py-2">
                {lang === "es" ? "Iniciá una conversación para ver tus beneficios" : "Start a conversation to see your available benefits"}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — Deadlines */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{tr.dashboard.deadlines.title}</h2>
            <span className="text-xs font-semibold text-gray-400">
              {metDeadlines.length}/{deadlines.length + planDerivedDeadlines.length} {lang === "es" ? "completados" : "completed"}
            </span>
          </div>
          {allDisplayDeadlines.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">
              {lang === "es" ? "0/0 plazos próximos" : "0/0 upcoming deadlines"}
            </p>
          )}
          {allDisplayDeadlines.slice(0, 4).map((d, i) => (
            <div key={i} className={`rounded-lg border-l-4 p-3 ${deadlineColor(d.daysLeft)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${deadlineTitleColor(d.daysLeft)}`}>
                    {tr.dashboard.deadlines.daysLeft(d.daysLeft)}{d.daysLeft <= 7 ? lang === "es" ? "Esta semana" : "This week" : new Date(d.dueDate).toLocaleDateString(lang === "es" ? "es-SV" : "en-US", { month: "short", day: "numeric" })}
                  </p>
                  <p className={`text-sm font-semibold mt-0.5 ${deadlineTitleColor(d.daysLeft)}`}>
                    {lang === "es" ? d.titleEs : d.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {d.daysLeft <= 7 ? tr.dashboard.deadlines.lateFeeMissed : tr.dashboard.deadlines.dontMissWindow}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => router.push("/plan")}
                  className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-600 hover:border-gray-400 transition-colors"
                >
                  {tr.dashboard.deadlines.seeStep}
                </button>
                <button
                  onClick={() => {
                    const name = lang === "es" ? d.titleEs : d.title
                    const msg = lang === "es"
                      ? `Ayudame a completar "${name}" — ¿qué documentos necesito y qué tengo que hacer?`
                      : `Help me complete "${name}" — what documents do I need and what are the steps?`
                    router.push(`/chat?msg=${encodeURIComponent(msg)}`)
                  }}
                  className="text-xs px-2.5 py-1 rounded-md bg-[#185FA5] text-white hover:bg-[#145290] transition-colors"
                >
                  {tr.dashboard.deadlines.askAgent}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Benefits */}
      <div className="px-4 pb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{tr.dashboard.benefits.title}</h2>
          <div className="space-y-2">
            {contextServices.map(svc => {
              const ent = entitlements.find(e => e.serviceId === svc.id)
              return (
                <div key={svc.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{lang === "es" ? svc.nameEs : svc.name}</p>
                    <p className="text-xs text-gray-400">{svc.agency}{svc.amount ? ` · ${svc.amount}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ent && (
                      <StatusBadge status={ent.status} lang={lang} />
                    )}
                    <button
                      onClick={() => {
                        const name = lang === "es" ? svc.nameEs : svc.name
                        const msg = lang === "es"
                          ? `Explícame el beneficio "${name}" (${svc.agency}). ¿Califico? ¿Qué documentos necesito y cómo lo solicito?`
                          : `Tell me about the "${name}" benefit (${svc.agency}). Do I qualify? What documents do I need and how do I apply?`
                        router.push(`/chat?msg=${encodeURIComponent(msg)}`)
                      }}
                      className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors flex items-center gap-1"
                    >
                      {tr.dashboard.benefits.askAgent}
                      <ChevronRight size={10} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgressRow({ icon, label, sub, value, total, color }: {
  icon: React.ReactNode
  label: string
  sub: string
  value: number
  total: number
  color: string
}) {
  const pct = safeDivide(value, total)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className="text-xs text-gray-500">{value} of {total}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const config: Record<string, { label: string; labelEs: string; cls: string }> = {
    new: { label: "New", labelEs: "Nuevo", cls: "bg-blue-50 text-blue-600" },
    applied: { label: "Applied", labelEs: "Solicitado", cls: "bg-amber-50 text-amber-600" },
    pending: { label: "Pending", labelEs: "Pendiente", cls: "bg-yellow-50 text-yellow-600" },
    received: { label: "Received", labelEs: "Recibido", cls: "bg-emerald-50 text-emerald-600" },
  }
  const c = config[status] || config.new
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}>
      {lang === "es" ? c.labelEs : c.label}
    </span>
  )
}

function EmptyDashboard({ tr, lang, router, firstName, hour }: any) {
  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <h1 className="text-xl font-semibold text-gray-900">
          {tr.dashboard.greeting(firstName || (lang === "es" ? "ahí" : "there"), hour)}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{tr.dashboard.subtitleEmpty}</p>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {/* CTA Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={22} className="text-[#185FA5]" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{tr.dashboard.empty.cardTitle}</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">{tr.dashboard.empty.cardSubtitle}</p>
          <button
            onClick={() => router.push("/chat")}
            className="inline-flex items-center gap-2 bg-[#185FA5] hover:bg-[#145290] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            <MessageSquare size={16} />
            {tr.dashboard.empty.ctaButton}
          </button>
        </div>

        {/* Preview rows */}
        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{tr.dashboard.empty.previewTitle}</p>
          {[
            { icon: <Gift size={16} />, title: tr.dashboard.empty.preview1, sub: tr.dashboard.empty.preview1Sub },
            { icon: <ListChecks size={16} />, title: tr.dashboard.empty.preview2, sub: tr.dashboard.empty.preview2Sub },
            { icon: <Calendar size={16} />, title: tr.dashboard.empty.preview3, sub: tr.dashboard.empty.preview3Sub },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3.5 opacity-45">
              <div className="text-gray-400 mt-0.5 flex-shrink-0">{item.icon}</div>
              <div>
                <p className="text-sm font-medium text-gray-700">{item.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
