"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import { services as kbServices } from "@/lib/kb"
import { getActiveSituations, unionServicesForSituations } from "@/lib/situations"
import { Gift, ListChecks, Calendar, MessageSquare, AlertCircle, ChevronRight, Loader2, Sparkles } from "lucide-react"

function getDaysLeft(dueDate: string) {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

const safeDivide = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100)

// Design handoff (Refined Navy): a deadline only gets the amber "most
// urgent" treatment if it's genuinely soon — same threshold the header's
// "N deadline(s) soon" badge already uses (urgentCount below). Highlighting
// whichever deadline happens to sort first regardless of how far out it is
// would read as a false alarm, the opposite of the brief's "calm, not
// intimidating" goal.
const URGENT_DAYS_THRESHOLD = 30

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
        <Loader2 size={24} className="animate-spin text-brand" />
      </div>
    )
  }

  // Resolve lifeEvent — prefer DB, fall back to localStorage signal captured during chat
  const resolvedLifeEvent = citizen?.profile.lifeEvent ||
    (typeof window !== "undefined" ? localStorage.getItem("ca_detected_life_event") : "") || ""
  const resolvedEmployment = citizen?.profile.employment ||
    (typeof window !== "undefined" ? localStorage.getItem("ca_detected_employment") : "") || "unknown"
  const resolvedCountry = citizen?.profile.country || "SV"

  // Empty state — no life event detected yet
  if (!resolvedLifeEvent) {
    return <EmptyDashboard tr={tr} lang={lang} router={router} firstName={citizen?.profile.firstName} hour={hour} />
  }

  // Union over every active situation (Phase 2a stragglers, Group 2) — a
  // multi-situation citizen's entitlement/claimed counts must reflect all of
  // them, not just the compat-primary lifeEvent.
  const situations = citizen ? getActiveSituations(citizen.profile) : (resolvedLifeEvent ? [resolvedLifeEvent] : [])
  const contextServices = unionServicesForSituations({
    country: resolvedCountry,
    situations,
    employment: resolvedEmployment,
    gender: citizen?.profile.gender,
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

  const urgentCount = allDisplayDeadlines.filter(d => d.daysLeft <= URGENT_DAYS_THRESHOLD).length

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

  // "YOUR PROGRESS" header summary — how many of the 3 tracked categories
  // are FULLY complete (not just started). A real, computable metric that
  // degrades to 0/3 for a brand-new citizen, same as the design reference.
  const categoriesComplete = [
    contextServices.length > 0 && claimedCount === contextServices.length,
    planSteps.length > 0 && doneSteps.length === planSteps.length,
    (deadlines.length + planDerivedDeadlines.length) > 0 && metDeadlines.length === (deadlines.length + planDerivedDeadlines.length),
  ].filter(Boolean).length

  return (
    <div className="h-screen overflow-y-auto bg-ca-surface-canvas">
      {/* Header */}
      <div className="bg-white border-b border-ca-surface-hairline px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              {tr.dashboard.greeting(citizen?.profile.firstName || (lang === "es" ? "ahí" : "there"), hour)}
            </h1>
            <p className="text-sm text-ca-text-secondary mt-0.5">{tr.dashboard.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-ca-danger-light text-ca-danger flex items-center gap-1.5">
                <AlertCircle size={13} />
                {tr.dashboard.urgentBadge(urgentCount)}
              </span>
            )}
            <a href="/preview" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-ca-yellow text-ca-ink hover:bg-ca-yellow-hover transition-colors">
              <Sparkles size={12} />{tr.common.preview}
            </a>
          </div>
        </div>

        {/* Context pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { emoji: "🛒", label: tr.contextPills[resolvedLifeEvent as keyof typeof tr.contextPills] || resolvedLifeEvent },
            resolvedEmployment !== "any" && { emoji: "💼", label: tr.contextPills[resolvedEmployment as keyof typeof tr.contextPills] || resolvedEmployment },
            resolvedCountry ? { emoji: "📍", label: resolvedCountry === "SV" ? "El Salvador" : resolvedCountry } : null,
          ].filter(Boolean).map((pill: any, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-ca-surface-canvas text-ca-text-secondary border border-ca-surface-border">
              {pill.emoji} {pill.label}
            </span>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 px-6 py-6">
        {/* LEFT — Progress */}
        <div className="bg-white rounded-2xl border border-ca-surface-border shadow-[0_1px_3px_rgba(16,24,40,.05)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-ca-text-tertiary uppercase tracking-wider">{tr.dashboard.progress.title}</h2>
            <span className="text-xs text-ca-text-tertiary">{categoriesComplete}/3 {lang === "es" ? "completado" : "completed"}</span>
          </div>

          {/* Benefits claimed */}
          <ProgressRow
            icon={<Gift size={14} className="text-brand" />}
            label={tr.dashboard.progress.benefitsClaimed}
            sub={tr.dashboard.progress.benefitsUnclaimed(contextServices.length - claimedCount)}
            value={claimedCount}
            total={contextServices.length}
            color="bg-brand"
            tr={tr}
          />

          {/* Plan steps */}
          <ProgressRow
            icon={<ListChecks size={14} className="text-ca-success" />}
            label={tr.dashboard.progress.planSteps}
            sub={planSteps.length === 0 ? (lang === "es" ? "Aún no hay plan" : "No plan yet") : nextStep ? tr.dashboard.progress.nextStep(nextStep.serviceName || nextStep.serviceId) : ""}
            value={doneSteps.length}
            total={planSteps.length || 1}
            color="bg-[#3C7D5A]"
            tr={tr}
          />

          {/* Deadlines met */}
          <ProgressRow
            icon={<Calendar size={14} className="text-ca-warn" />}
            label={tr.dashboard.progress.deadlinesMet}
            sub={tr.dashboard.progress.deadlinesComingUp(allDisplayDeadlines.length)}
            value={metDeadlines.length}
            total={deadlines.length + planDerivedDeadlines.length}
            color="bg-[#B58233]"
            tr={tr}
          />

          {/* Total value */}
          {totalValueMonthly > 0 ? (
            <div className="pt-3 border-t border-ca-surface-hairline">
              <p className="text-xs text-ca-text-secondary">{tr.dashboard.progress.totalValue}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">${totalValueMonthly.toLocaleString()}<span className="text-sm font-normal text-ca-text-tertiary">/mo</span></p>
              <p className="text-xs text-ca-text-tertiary">{tr.dashboard.progress.totalValueSub}</p>
            </div>
          ) : entitlements.length === 0 && (
            <div className="pt-3 border-t border-ca-surface-hairline">
              <p className="text-xs text-ca-text-tertiary text-center py-2">
                {lang === "es" ? "Iniciá una conversación para ver tus beneficios" : "Start a conversation to see your available benefits"}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — Deadlines */}
        <div className="bg-white rounded-2xl border border-ca-surface-border shadow-[0_1px_3px_rgba(16,24,40,.05)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-ca-text-tertiary uppercase tracking-wider">{tr.dashboard.deadlines.title}</h2>
            <span className="text-xs font-semibold text-ca-text-tertiary">
              {metDeadlines.length}/{deadlines.length + planDerivedDeadlines.length} {lang === "es" ? "completados" : "completed"}
            </span>
          </div>
          {allDisplayDeadlines.length === 0 && (
            <p className="text-sm text-ca-text-tertiary py-4 text-center">
              {lang === "es" ? "0/0 plazos próximos" : "0/0 upcoming deadlines"}
            </p>
          )}
          {allDisplayDeadlines.slice(0, 4).map((d, i) => {
            const isUrgent = d.daysLeft <= URGENT_DAYS_THRESHOLD
            return (
              <div
                key={i}
                className={isUrgent
                  ? "rounded-r-[10px] border-l-[3px] border-ca-yellow bg-[#FFFBEB] px-3.5 py-2.5"
                  : "border-l-[3px] border-ca-surface-input px-3.5 py-2.5"}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-[11.5px] font-bold ${isUrgent ? "text-ca-warn" : "text-ca-text-tertiary"}`}>
                    {tr.dashboard.deadlines.daysLeft(d.daysLeft)}{new Date(d.dueDate).toLocaleDateString(lang === "es" ? "es-SV" : "en-US", { month: "short", day: "numeric" })}
                  </p>
                  <p className="text-[13.5px] font-semibold text-gray-900 mt-0.5">
                    {lang === "es" ? d.titleEs : d.title}
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => router.push("/plan")}
                    className="text-xs px-2.5 py-1 rounded-md border border-ca-surface-input text-ca-text-secondary hover:border-gray-400 transition-colors"
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
                    className="text-xs px-2.5 py-1 rounded-md bg-brand text-white hover:bg-brand-dark transition-colors"
                  >
                    {tr.dashboard.deadlines.askAgent}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* All Benefits */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-2xl border border-ca-surface-border shadow-[0_1px_3px_rgba(16,24,40,.05)] p-5">
          <h2 className="text-xs font-bold text-ca-text-tertiary uppercase tracking-wider mb-3">{tr.dashboard.benefits.title}</h2>
          <div>
            {contextServices.map(svc => {
              const ent = entitlements.find(e => e.serviceId === svc.id)
              return (
                <div key={svc.id} className="flex items-center justify-between py-3 border-b border-ca-surface-hairline last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{lang === "es" ? svc.nameEs : svc.name}</p>
                    <p className="text-xs text-ca-text-secondary mt-0.5">{svc.agency}{svc.amount ? ` · ${svc.amount}` : ""}</p>
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
                      className="text-xs px-2.5 py-1 rounded-md border border-ca-surface-input text-ca-text-secondary hover:border-brand hover:text-brand transition-colors flex items-center gap-1"
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

function ProgressRow({ icon, label, sub, value, total, color, tr }: {
  icon: React.ReactNode
  label: string
  sub: string
  value: number
  total: number
  color: string
  tr: ReturnType<typeof t>
}) {
  const pct = safeDivide(value, total)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-semibold text-gray-800">{label}</span>
        </div>
        <span className="text-xs text-ca-text-secondary">{tr.dashboard.progress.ofTotal(value, total)}</span>
      </div>
      <div className="h-1.5 bg-ca-track rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      {sub && <p className="text-xs text-ca-text-tertiary truncate">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const config: Record<string, { label: string; labelEs: string; cls: string }> = {
    new:      { label: "New",      labelEs: "Nuevo",     cls: "bg-brand-light text-brand" },
    applied:  { label: "Applied",  labelEs: "Solicitado", cls: "bg-ca-warn-light text-ca-warn" },
    pending:  { label: "Pending",  labelEs: "Pendiente",  cls: "bg-ca-warn-light text-ca-warn" },
    received: { label: "Received", labelEs: "Recibido",   cls: "bg-ca-success-light text-ca-success" },
  }
  const c = config[status] || config.new
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${c.cls}`}>
      {lang === "es" ? c.labelEs : c.label}
    </span>
  )
}

function EmptyDashboard({ tr, lang, router, firstName, hour }: any) {
  return (
    <div className="h-screen overflow-y-auto bg-ca-surface-canvas">
      <div className="bg-white border-b border-ca-surface-hairline px-6 py-5">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          {tr.dashboard.greeting(firstName || (lang === "es" ? "ahí" : "there"), hour)}
        </h1>
        <p className="text-sm text-ca-text-secondary mt-0.5">{tr.dashboard.subtitleEmpty}</p>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {/* CTA Card */}
        <div className="bg-white rounded-2xl border border-ca-surface-border shadow-[0_1px_3px_rgba(16,24,40,.05)] p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={22} className="text-brand" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{tr.dashboard.empty.cardTitle}</h2>
          <p className="text-sm text-ca-text-secondary mb-6 max-w-sm mx-auto">{tr.dashboard.empty.cardSubtitle}</p>
          <button
            onClick={() => router.push("/chat")}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            <MessageSquare size={16} />
            {tr.dashboard.empty.ctaButton}
          </button>
        </div>

        {/* Preview rows */}
        <div className="mt-6 space-y-3">
          <p className="text-xs font-bold text-ca-text-tertiary uppercase tracking-wider">{tr.dashboard.empty.previewTitle}</p>
          {[
            { icon: <Gift size={16} />, title: tr.dashboard.empty.preview1, sub: tr.dashboard.empty.preview1Sub },
            { icon: <ListChecks size={16} />, title: tr.dashboard.empty.preview2, sub: tr.dashboard.empty.preview2Sub },
            { icon: <Calendar size={16} />, title: tr.dashboard.empty.preview3, sub: tr.dashboard.empty.preview3Sub },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 bg-white rounded-xl border border-ca-surface-border px-4 py-3.5 opacity-45">
              <div className="text-ca-text-tertiary mt-0.5 flex-shrink-0">{item.icon}</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                <p className="text-xs text-ca-text-tertiary mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
