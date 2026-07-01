"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import { lookupServices, services as kbServices } from "@/lib/kb"
import {
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  Loader2, HelpCircle, ExternalLink, MessageSquare,
  MoreHorizontal, Info, Trash2, Sparkles,
} from "lucide-react"

interface PlanStep {
  serviceId: string
  title: string
  agency: string
  agencyAddress?: string
  deadline: string | null
  estimatedTime?: string
  cost?: string
  documents: string[]
  whatToSayWhenYouArrive?: string
  whatToDoIfProblems?: string
  canDoOnline?: boolean
  onlineUrl?: string | null
  why?: string
  status: "not-started" | "in-progress" | "done"
}

interface PlanWeek {
  week: number
  label: string
  steps: PlanStep[]
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

export default function PlanPage() {
  const router = useRouter()
  const { lang } = useLang()
  const { citizen, refresh, isLoading: citizenLoading } = useCitizen()
  const tr = t(lang)

  const [plan, setPlan] = useState<PlanWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [planError, setPlanError] = useState<string | null>(null)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]))
  const [completingStep, setCompletingStep] = useState<string | null>(null)
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set())
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<string | null>(null)
  const [deletingStep, setDeletingStep] = useState<string | null>(null)
  // Track whether we've done the initial mount refresh to avoid loops
  const didMountRefresh = useRef(false)

  const allSteps = plan.flatMap(w => w.steps)
  const doneSteps = allSteps.filter(s => s.status === "done")
  const progress = allSteps.length > 0 ? Math.round((doneSteps.length / allSteps.length) * 100) : 0
  const urgentStep = allSteps.find(s => s.status !== "done" && s.deadline)

  useEffect(() => {
    // Don't run until CitizenContext finishes its initial fetch
    if (citizenLoading) return

    if (!didMountRefresh.current) {
      // First time: always pull latest from DB before deciding to generate.
      // The chat page may have just saved a brand-new plan and we need
      // the updated planSteps + planLifeEvent to avoid a redundant re-generation.
      didMountRefresh.current = true
      refresh()
        .then(fresh => generateOrLoadPlan(fresh ?? citizen))
        .catch(() => generateOrLoadPlan(citizen))
    } else {
      // Subsequent dep changes (lang switch, etc.): use current citizen state
      generateOrLoadPlan(citizen)
    }
  }, [citizen?.profile?.lifeEvent, lang, citizenLoading])

  // Accept the citizen data directly so we never read a stale closure value
  const generateOrLoadPlan = async (currentCitizen: typeof citizen) => {
    // Resolve lifeEvent: prefer DB citizen, fall back to localStorage signals
    // set by the chat page when the user typed their situation
    const lifeEvent  = currentCitizen?.profile?.lifeEvent  || (typeof window !== "undefined" ? localStorage.getItem("ca_detected_life_event")  : "") || ""
    const employment = currentCitizen?.profile?.employment  || (typeof window !== "undefined" ? localStorage.getItem("ca_detected_employment")  : "") || "any"
    const country    = currentCitizen?.profile?.country     || "SV"
    const citizenId  = currentCitizen?.citizenId

    setPlanError(null)

    if (!lifeEvent) { setLoading(false); return }

    // Use stored plan if it exists AND belongs to this life event.
    // Also accept plans where planLifeEvent is null/undefined — these are legacy plans
    // that were saved before we tracked the life event on ActionPlan, so we trust them.
    const hasStoredPlan = (currentCitizen?.planSteps?.length ?? 0) > 0
    const planIsFresh = hasStoredPlan && (
      currentCitizen?.planLifeEvent === lifeEvent ||
      !currentCitizen?.planLifeEvent               // legacy plan — no lifeEvent stored
    )

    console.log("Plan check:", {
      planStepsLength: currentCitizen?.planSteps?.length,
      planLifeEvent:   currentCitizen?.planLifeEvent,
      contextLifeEvent: lifeEvent,
      planIsFresh,
    })

    if (planIsFresh) {
      const grouped = groupStepsByWeek(currentCitizen!.planSteps as any)
      setPlan(grouped)
      setLoading(false)
      return
    }

    if (hasStoredPlan && !planIsFresh) {
      console.log("Plan is stale (was for", currentCitizen?.planLifeEvent, ", now need", lifeEvent, ") — regenerating")
    }

    // Anonymous users can't generate plans — no place to save them
    if (!citizenId) {
      console.warn("No citizenId — cannot generate plan for anonymous user")
      setLoading(false)
      setPlanError("no-citizen")
      return
    }

    // No fresh stored plan — generate via Gemini
    setLoading(true)
    try {
      const services = lookupServices({ country, lifeEvent, employment })
      console.log("Plan page generating plan:", lifeEvent, "→", services.length, "services")

      if (services.length === 0) {
        console.warn("No services found for", lifeEvent, employment)
        setLoading(false)
        setPlanError("no-services")
        return
      }

      // Always inject the resolved lifeEvent so savePlanToDB stores the right value
      const profile = {
        firstName: currentCitizen?.profile?.firstName || "there",
        country,
        lifeEvent,     // resolved (not raw DB value which may be "")
        employment,
        language: (currentCitizen?.profile?.language || lang) as "en" | "es",
      }

      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citizenId, services, profile, language: lang }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error("Plan API error:", res.status, errText)
        setPlanError("api-error")
        setLoading(false)
        return
      }

      const data = await res.json()
      if (!data.weeks || !Array.isArray(data.weeks)) {
        console.error("Plan API returned invalid structure:", data)
        setPlanError("api-error")
        setLoading(false)
        return
      }

      const weeks: PlanWeek[] = data.weeks
        .filter((w: any) => w.steps?.length > 0)
        .map((w: any) => ({
          ...w,
          steps: w.steps.map((s: any) => ({ ...s, status: s.status || "not-started" })),
        }))
      setPlan(weeks)

      // Refresh context so planSteps / planLifeEvent are up-to-date on next visit
      refresh().catch(() => {})
    } catch (err) {
      console.error("Plan generation error:", err)
      setPlanError("api-error")
    } finally {
      setLoading(false)
    }
  }

  const groupStepsByWeek = (steps: any[]): PlanWeek[] => {
    const weekMap = new Map<number, PlanWeek>()
    steps.forEach(s => {
      const wk = s.week || 1
      if (!weekMap.has(wk)) {
        weekMap.set(wk, { week: wk, label: `Phase ${wk}`, steps: [] })
      }
      weekMap.get(wk)!.steps.push(s)
    })
    return Array.from(weekMap.values()).sort((a, b) => a.week - b.week)
  }

  const toggleWeek = (week: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      if (next.has(week)) next.delete(week)
      else next.add(week)
      return next
    })
  }

  const toggleTip = (key: string) => {
    setExpandedTips(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleStep = async (step: PlanStep, weekNum: number) => {
    const newStatus = step.status === "done" ? "not-started" : "done"
    setCompletingStep(step.serviceId)

    // Match by both serviceId AND week to avoid toggling duplicate serviceIds across phases
    setPlan(prev => prev.map(w => ({
      ...w,
      steps: w.steps.map(s =>
        s.serviceId === step.serviceId && w.week === weekNum
          ? { ...s, status: newStatus } : s
      )
    })))

    if (citizen?.citizenId) {
      await fetch("/api/plan/step", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citizenId: citizen?.citizenId, serviceId: step.serviceId, week: weekNum, completed: newStatus === "done" }),
      }).catch(() => {})
    }
    setCompletingStep(null)
  }

  const handleDeleteStep = async (step: PlanStep) => {
    setConfirmDeleteStep(null)
    setDeletingStep(step.serviceId)

    // Optimistic update — remove step and empty weeks
    setPlan(prev => prev
      .map(w => ({ ...w, steps: w.steps.filter(s => s.serviceId !== step.serviceId) }))
      .filter(w => w.steps.length > 0)
    )

    if (citizen?.citizenId) {
      await fetch("/api/plan/step", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citizenId: citizen?.citizenId, serviceId: step.serviceId }),
      }).catch(() => {})
    }
    setDeletingStep(null)
  }

  const handleAskAgent = (step: PlanStep) => {
    const autoMsg = `Explain this plan step to me in detail: "${step.title}" at ${step.agency}. What do I do when I arrive, what do I say at the counter, what documents do I need (${(step.documents || []).join(", ")}), how long does it take, and what if something goes wrong?`
    router.push(`/chat?msg=${encodeURIComponent(autoMsg)}`)
  }

  const handleDocInfo = (docName: string) => {
    const msg = `Tell me about the document: ${docName}. What is it, where do I get it if I don't have it, and how long does it take?`
    router.push(`/chat?msg=${encodeURIComponent(msg)}`)
  }

  // Wait for citizen context to finish loading before showing "no plan" empty state
  if (citizenLoading || (!citizen && loading)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={24} className="animate-spin text-[#185FA5]" />
      </div>
    )
  }

  const resolvedLifeEvent = citizen?.profile?.lifeEvent ||
    (typeof window !== "undefined" ? localStorage.getItem("ca_detected_life_event") : "") || ""

  if (!resolvedLifeEvent) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-16 text-center">
        <HelpCircle size={40} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          {lang === "es" ? "No hay plan aún" : "No plan yet"}
        </h2>
        <p className="text-sm text-gray-400 mb-6 max-w-xs">
          {lang === "es" ? "Contanos tu situación en el chat para generar tu plan." : "Tell us your situation in the chat to generate your plan."}
        </p>
        <button
          onClick={() => router.push("/chat")}
          className="bg-[#185FA5] hover:bg-[#145290] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          {lang === "es" ? "Ir al chat" : "Go to chat"}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={24} className="animate-spin text-[#185FA5]" />
        <p className="text-sm text-gray-500">
          {lang === "es" ? "Generando tu plan..." : "Generating your plan..."}
        </p>
      </div>
    )
  }

  if (planError) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-16 text-center">
        <HelpCircle size={40} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          {planError === "no-citizen"
            ? (lang === "es" ? "Necesitás una cuenta" : "Account required")
            : (lang === "es" ? "No se pudo generar el plan" : "Couldn't generate plan")}
        </h2>
        <p className="text-sm text-gray-400 mb-6 max-w-xs">
          {planError === "no-citizen"
            ? (lang === "es" ? "Completá el registro para guardar tu plan personalizado." : "Complete registration to save your personalised plan.")
            : (lang === "es" ? "Hubo un error al generar tu plan. Intentá de nuevo desde el chat." : "There was an error generating your plan. Try again from the chat.")}
        </p>
        <button
          onClick={() => router.push("/chat")}
          className="bg-[#185FA5] hover:bg-[#145290] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          {lang === "es" ? "Volver al chat" : "Back to chat"}
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{tr.plan.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {tr.profile.lifeEvents[resolvedLifeEvent as keyof typeof tr.profile.lifeEvents] || resolvedLifeEvent}
            </p>
            {citizen?.planUpdatedAt && (
              <p className="text-xs text-gray-400 mt-1">
                {lang === "es" ? "Actualizado:" : "Last updated:"} {formatUpdatedAt(citizen.planUpdatedAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a href="/preview" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-colors">
              <Sparkles size={12} />Preview
            </a>
            {allSteps.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                {tr.plan.progress(doneSteps.length, allSteps.length)}
              </span>
            )}
          </div>
        </div>

        {allSteps.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#185FA5] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Urgent alert */}
      {urgentStep?.deadline && (
        <div className="mx-4 mt-4 p-4 rounded-xl border-l-4 border-red-500 bg-red-50">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                {tr.plan.urgentTitle} {urgentStep.deadline}
              </p>
              <p className="text-xs text-red-600 mt-0.5">{urgentStep.title} — {urgentStep.agency}</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan weeks */}
      <div className="px-4 py-4 space-y-3">
        {plan.map(week => {
          const isExpanded = expandedWeeks.has(week.week)
          const weekDone = week.steps.filter(s => s.status === "done").length
          return (
            <div key={week.week} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              {/* Week header */}
              <button
                onClick={() => toggleWeek(week.week)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {week.week === 1
                      ? (lang === "es" ? "FASE 1 — HACÉ ESTO PRIMERO" : "PHASE 1 — DO THESE FIRST")
                      : (lang === "es" ? `FASE ${week.week}` : `PHASE ${week.week}`)}
                  </span>
                  {weekDone > 0 && (
                    <span className="text-xs text-emerald-600 font-medium">
                      {weekDone}/{week.steps.length}
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>

              {/* Steps */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-gray-50">
                      {week.steps.map((step, idx) => {
                        const isDone = step.status === "done"
                        const isCompleting = completingStep === step.serviceId
                        const isDeleting = deletingStep === step.serviceId
                        const isActive = !isDone && idx === week.steps.findIndex(s => s.status !== "done")
                        const sayKey = `say-${step.serviceId}`
                        const probKey = `prob-${step.serviceId}`
                        const showDeleteConfirm = confirmDeleteStep === step.serviceId

                        return (
                          <div
                            key={step.serviceId}
                            className={`border-l-4 p-4 transition-all ${isDeleting ? "opacity-40" : ""}
                              ${isDone ? "border-emerald-400 opacity-60" : isActive ? "border-[#185FA5]" : "border-gray-200"}`}
                          >
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                {isCompleting ? (
                                  <Loader2 size={18} className="animate-spin text-[#185FA5] mt-0.5 flex-shrink-0" />
                                ) : isDone ? (
                                  <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                ) : isActive ? (
                                  <div className="w-5 h-5 rounded-full bg-[#185FA5] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 mt-0.5">
                                    {idx + 1}
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold leading-snug ${isDone ? "line-through text-gray-400" : "text-gray-800"}`}>
                                    {step.title}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">{step.agency}</p>
                                  {step.deadline && (
                                    <p className="text-xs text-amber-600 font-medium mt-0.5">{tr.plan.deadline} {step.deadline}</p>
                                  )}
                                  {/* Online badge */}
                                  {step.canDoOnline && step.onlineUrl && (
                                    <a
                                      href={step.onlineUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors mt-1"
                                    >
                                      <ExternalLink size={9} />
                                      {lang === "es" ? "Hacer en línea" : "Do online"}
                                    </a>
                                  )}
                                </div>
                              </div>
                              {/* Apply now + Delete */}
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {(() => {
                                  const kbSvc = kbServices.find(k => k.id === step.serviceId)
                                  const applyUrl = step.onlineUrl || kbSvc?.sourceUrl
                                  return applyUrl ? (
                                    <a
                                      href={applyUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg bg-[#185FA5] text-white hover:bg-[#145290] transition-colors"
                                    >
                                      <ExternalLink size={10} />
                                      {lang === "es" ? "Aplicar" : "Apply now"}
                                    </a>
                                  ) : null
                                })()}
                                <button
                                  onClick={() => setConfirmDeleteStep(showDeleteConfirm ? null : step.serviceId)}
                                  className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors rounded"
                                  title={lang === "es" ? "Eliminar paso" : "Remove step"}
                                  disabled={isDeleting}
                                >
                                  <MoreHorizontal size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Inline delete confirm */}
                            {showDeleteConfirm && (
                              <div className="flex items-center gap-2 mt-2 text-xs py-1 border-b border-gray-100">
                                <Trash2 size={11} className="text-red-400 flex-shrink-0" />
                                <span className="text-gray-500">{lang === "es" ? "¿Eliminar este paso?" : "Remove this step?"}</span>
                                <button onClick={() => handleDeleteStep(step)} className="text-red-500 hover:text-red-600 font-semibold">
                                  {lang === "es" ? "Eliminar" : "Remove"}
                                </button>
                                <button onClick={() => setConfirmDeleteStep(null)} className="text-gray-400 hover:text-gray-600">
                                  {lang === "es" ? "Cancelar" : "Cancel"}
                                </button>
                              </div>
                            )}

                            {/* Documents */}
                            {step.documents?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-gray-400 mb-1.5">{tr.plan.bringDocuments}</p>
                                <div className="flex flex-wrap gap-1">
                                  {step.documents.map((doc, di) => (
                                    <button
                                      key={di}
                                      onClick={() => handleDocInfo(doc)}
                                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#185FA5] transition-colors bg-gray-50 hover:bg-blue-50 px-2 py-0.5 rounded-full border border-gray-200 hover:border-[#B5D4F4]"
                                    >
                                      <Info size={9} />
                                      {doc}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* What to say — blue block, always open for active, collapsible for others */}
                            {!isDone && step.whatToSayWhenYouArrive && (
                              <>
                                {isActive ? (
                                  <div className="mt-3 bg-blue-50 rounded-xl p-3">
                                    <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1.5">
                                      <MessageSquare size={11} />
                                      {lang === "es" ? "Qué decir al llegar" : "What to say"}
                                    </p>
                                    <p className="text-xs text-blue-800 leading-relaxed">&ldquo;{step.whatToSayWhenYouArrive}&rdquo;</p>
                                  </div>
                                ) : (
                                  <div className="mt-2">
                                    <button
                                      onClick={() => toggleTip(sayKey)}
                                      className="flex items-center gap-1 text-xs text-[#185FA5] hover:text-[#145290] transition-colors"
                                    >
                                      <MessageSquare size={11} />
                                      {lang === "es" ? "Qué decir al llegar" : "What to say"}
                                      {expandedTips.has(sayKey) ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                    </button>
                                    {expandedTips.has(sayKey) && (
                                      <div className="mt-1.5 bg-blue-50 rounded-xl p-3">
                                        <p className="text-xs text-blue-800 leading-relaxed">&ldquo;{step.whatToSayWhenYouArrive}&rdquo;</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                            {/* If problems — amber block, always open for active, collapsible for others */}
                            {!isDone && step.whatToDoIfProblems && (
                              <>
                                {isActive ? (
                                  <div className="mt-2 bg-amber-50 rounded-xl p-3">
                                    <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1.5">
                                      <AlertCircle size={11} />
                                      {lang === "es" ? "Si algo sale mal" : "If something goes wrong"}
                                    </p>
                                    <p className="text-xs text-amber-800 leading-relaxed">{step.whatToDoIfProblems}</p>
                                  </div>
                                ) : (
                                  <div className="mt-1.5">
                                    <button
                                      onClick={() => toggleTip(probKey)}
                                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                      <AlertCircle size={11} />
                                      {lang === "es" ? "Si algo sale mal" : "If something goes wrong"}
                                      {expandedTips.has(probKey) ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                    </button>
                                    {expandedTips.has(probKey) && (
                                      <div className="mt-1.5 bg-amber-50 rounded-xl p-3">
                                        <p className="text-xs text-amber-800 leading-relaxed">{step.whatToDoIfProblems}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                            {/* Bottom row: Ask agent (left) + Mark as done / Done (right) */}
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                              <button
                                onClick={() => handleAskAgent(step)}
                                className="text-xs text-gray-400 hover:text-[#185FA5] transition-colors"
                              >
                                {lang === "es" ? "Preguntar al agente" : "Ask agent"}
                              </button>
                              {isDone ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                  <CheckCircle2 size={11} />
                                  {lang === "es" ? "Hecho" : "Done"}
                                </span>
                              ) : (
                                <button
                                  onClick={() => toggleStep(step, week.week)}
                                  disabled={isCompleting || isDeleting}
                                  className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#185FA5] text-white hover:bg-[#0C447C] transition-colors disabled:opacity-50"
                                >
                                  {isCompleting ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                  {lang === "es" ? "Marcar como hecho" : "Mark as done"}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
