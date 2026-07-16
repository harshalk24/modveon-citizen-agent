"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import { lookupServices, services as kbServices } from "@/lib/kb"
import { getActiveSituations } from "@/lib/situations"
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
  // Phase 2a: which active situation this step belongs to.
  situation?: string
}

interface PlanPhase {
  phase: number
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

  const [plan, setPlan] = useState<PlanPhase[]>([])
  const [loading, setLoading] = useState(true)
  const [planError, setPlanError] = useState<string | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1]))
  const [completingStep, setCompletingStep] = useState<string | null>(null)
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set())
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<string | null>(null)
  const [deletingStep, setDeletingStep] = useState<string | null>(null)
  // Track whether we've done the initial mount refresh to avoid loops
  const didMountRefresh = useRef(false)

  const allSteps = plan.flatMap(p => p.steps)
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
      const grouped = groupStepsByPhase(currentCitizen!.planSteps as any)
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
      // Task 2b-3: the server derives services/profile from the citizen's
      // stored situations (getActiveSituations + unionServicesForSituations,
      // same 2a helpers) — this client no longer computes/sends them, so it
      // can never forget to union (the straggler bug class). The old
      // client-side "no services found" precheck is gone too: it rendered
      // the exact same UI text as a generic api-error, so a non-ok response
      // below covers it identically.
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citizenId, language: lang }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error("Plan API error:", res.status, errText)
        setPlanError("api-error")
        setLoading(false)
        return
      }

      const data = await res.json()
      if (!data.phases || !Array.isArray(data.phases)) {
        console.error("Plan API returned invalid structure:", data)
        setPlanError("api-error")
        setLoading(false)
        return
      }

      const phases: PlanPhase[] = data.phases
        .filter((p: any) => p.steps?.length > 0)
        .map((p: any) => ({
          ...p,
          steps: p.steps.map((s: any) => ({ ...s, status: s.status || "not-started" })),
        }))
      setPlan(phases)

      // Refresh context so planSteps / planLifeEvent are up-to-date on next visit
      refresh().catch(() => {})
    } catch (err) {
      console.error("Plan generation error:", err)
      setPlanError("api-error")
    } finally {
      setLoading(false)
    }
  }

  const groupStepsByPhase = (steps: any[]): PlanPhase[] => {
    const phaseMap = new Map<number, PlanPhase>()
    steps.forEach(s => {
      const ph = s.phase || 1
      if (!phaseMap.has(ph)) {
        phaseMap.set(ph, { phase: ph, label: `Phase ${ph}`, steps: [] })
      }
      phaseMap.get(ph)!.steps.push(s)
    })
    return Array.from(phaseMap.values()).sort((a, b) => a.phase - b.phase)
  }

  const togglePhase = (phase: number) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phase)) next.delete(phase)
      else next.add(phase)
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

  const toggleStep = async (step: PlanStep, phaseNum: number) => {
    const newStatus = step.status === "done" ? "not-started" : "done"
    setCompletingStep(step.serviceId)

    // Match by both serviceId AND phase to avoid toggling duplicate serviceIds across phases
    setPlan(prev => prev.map(p => ({
      ...p,
      steps: p.steps.map(s =>
        s.serviceId === step.serviceId && p.phase === phaseNum
          ? { ...s, status: newStatus } : s
      )
    })))

    if (citizen?.citizenId) {
      await fetch("/api/plan/step", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citizenId: citizen?.citizenId, serviceId: step.serviceId, phase: phaseNum, completed: newStatus === "done" }),
      }).catch(() => {})
    }
    setCompletingStep(null)
  }

  const handleDeleteStep = async (step: PlanStep) => {
    setConfirmDeleteStep(null)
    setDeletingStep(step.serviceId)

    // Optimistic update — remove step and empty phases
    setPlan(prev => prev
      .map(p => ({ ...p, steps: p.steps.filter(s => s.serviceId !== step.serviceId) }))
      .filter(p => p.steps.length > 0)
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
        <Loader2 size={24} className="animate-spin text-brand" />
      </div>
    )
  }

  const resolvedLifeEvent = citizen?.profile?.lifeEvent ||
    (typeof window !== "undefined" ? localStorage.getItem("ca_detected_life_event") : "") || ""

  // Phase 2a: show every active situation in the subtitle, not just the
  // compat-primary one, so a multi-situation citizen sees their full context.
  const activeSituationLabels = (citizen ? getActiveSituations(citizen.profile) : (resolvedLifeEvent ? [resolvedLifeEvent] : []))
    .map(s => tr.profile.lifeEvents[s as keyof typeof tr.profile.lifeEvents] || s)

  if (!resolvedLifeEvent) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-16 text-center">
        <HelpCircle size={40} className="text-ca-text-tertiary/50 mb-4" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          {lang === "es" ? "No hay plan aún" : "No plan yet"}
        </h2>
        <p className="text-sm text-ca-text-tertiary mb-6 max-w-xs">
          {lang === "es" ? "Contanos tu situación en el chat para generar tu plan." : "Tell us your situation in the chat to generate your plan."}
        </p>
        <button
          onClick={() => router.push("/chat")}
          className="bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          {lang === "es" ? "Ir al chat" : "Go to chat"}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={24} className="animate-spin text-brand" />
        <p className="text-sm text-ca-text-secondary">
          {lang === "es" ? "Generando tu plan..." : "Generating your plan..."}
        </p>
      </div>
    )
  }

  if (planError) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-16 text-center">
        <HelpCircle size={40} className="text-ca-text-tertiary/50 mb-4" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          {planError === "no-citizen"
            ? (lang === "es" ? "Necesitás una cuenta" : "Account required")
            : (lang === "es" ? "No se pudo generar el plan" : "Couldn't generate plan")}
        </h2>
        <p className="text-sm text-ca-text-tertiary mb-6 max-w-xs">
          {planError === "no-citizen"
            ? (lang === "es" ? "Completá el registro para guardar tu plan personalizado." : "Complete registration to save your personalised plan.")
            : (lang === "es" ? "Hubo un error al generar tu plan. Intentá de nuevo desde el chat." : "There was an error generating your plan. Try again from the chat.")}
        </p>
        <button
          onClick={() => router.push("/chat")}
          className="bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          {lang === "es" ? "Volver al chat" : "Back to chat"}
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-y-auto bg-ca-surface-canvas">
      {/* Header */}
      <div className="bg-white border-b border-ca-surface-hairline px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">{tr.plan.title}</h1>
            <p className="text-sm text-ca-text-secondary mt-0.5">
              {activeSituationLabels.length > 1 ? activeSituationLabels.join(" · ") : (activeSituationLabels[0] || resolvedLifeEvent)}
            </p>
            {citizen?.planUpdatedAt && (
              <p className="text-xs text-ca-text-tertiary mt-1">
                {lang === "es" ? "Actualizado:" : "Last updated:"} {formatUpdatedAt(citizen.planUpdatedAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {allSteps.length > 0 && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-ca-success-light text-ca-success">
                {tr.plan.progress(doneSteps.length, allSteps.length)}
              </span>
            )}
            <a href="/preview" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-ca-yellow text-ca-ink hover:bg-ca-yellow-hover transition-colors">
              <Sparkles size={12} />Preview
            </a>
          </div>
        </div>

        {allSteps.length > 0 && (
          <div className="h-1.5 bg-ca-track rounded-full overflow-hidden mt-3.5">
            <motion.div
              className="h-full bg-[#3C7D5A] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        )}
      </div>

      {/* Urgent alert */}
      {urgentStep?.deadline && (
        <div className="mx-6 mt-4 flex gap-2.5 rounded-r-[11px] border-l-[3px] border-[#D64242] bg-ca-danger-light px-4 py-3.5">
          <AlertCircle size={17} className="text-ca-danger mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-ca-danger">
              {tr.plan.urgentTitle} {urgentStep.deadline}
            </p>
            <p className="text-xs text-ca-danger mt-0.5">{urgentStep.title} — {urgentStep.agency}</p>
          </div>
        </div>
      )}

      {/* Plan phases */}
      <div className="px-6 py-4 space-y-3">
        {plan.map(phase => {
          const isExpanded = expandedPhases.has(phase.phase)
          const phaseDone = phase.steps.filter(s => s.status === "done").length
          return (
            <div key={phase.phase} className="space-y-3">
              {/* Phase label */}
              <button
                onClick={() => togglePhase(phase.phase)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-ca-text-tertiary uppercase tracking-wider">
                    {phase.phase === 1
                      ? (lang === "es" ? "FASE 1 — HACÉ ESTO PRIMERO" : "PHASE 1 — DO THESE FIRST")
                      : (lang === "es" ? `FASE ${phase.phase}` : `PHASE ${phase.phase}`)}
                  </span>
                  {phaseDone > 0 && (
                    <span className="text-xs text-ca-success font-semibold">
                      {phaseDone}/{phase.steps.length}
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-ca-text-tertiary" /> : <ChevronDown size={14} className="text-ca-text-tertiary" />}
              </button>

              {/* Steps — a plain conditional render (no height animation).
                  framer-motion's height:0->"auto" measures the DOM at
                  animation start; on the VERY FIRST render after the plan
                  finishes loading, that can lock in a stale/short height and
                  clip the active step's card (confirmed live: collapsing and
                  re-expanding the phase "fixes" it, since the second
                  measurement is correct — that's the height:"auto" footgun,
                  not a data bug). A first-time visitor's first view of their
                  plan is exactly the moment this can't be allowed to happen,
                  so this trades the collapse/expand height animation for one
                  that can't silently clip real content. */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                    <div className="space-y-3">
                      {phase.steps.map((step, idx) => {
                        const isDone = step.status === "done"
                        const isCompleting = completingStep === step.serviceId
                        const isDeleting = deletingStep === step.serviceId
                        const isActive = !isDone && idx === phase.steps.findIndex(s => s.status !== "done")
                        const sayKey = `say-${step.serviceId}`
                        const probKey = `prob-${step.serviceId}`
                        const showDeleteConfirm = confirmDeleteStep === step.serviceId

                        // Design handoff (Refined Navy): only the ACTIVE step gets
                        // the rich card (documents/what-to-say/if-problems/apply
                        // button) — matches the mock's step-2 example, which
                        // collapses a not-yet-reached step to just a circle +
                        // title + deadline. This is a deliberate hierarchy change
                        // (not just a recolor): "one obvious next action" per the
                        // brief's low-literacy/high-anxiety usability goal, so a
                        // multi-step plan doesn't dump every step's full detail on
                        // an anxious first-time user at once. Delete stays
                        // available on every row (not just active) — collapsing
                        // detail shouldn't also remove a real capability the
                        // mock's static prototype simply didn't happen to render.
                        if (!isActive) {
                          return (
                            <div key={step.serviceId}>
                              <div
                                className={`bg-white border border-ca-surface-border px-5 py-4 flex items-center gap-3.5 transition-opacity ${showDeleteConfirm ? "rounded-t-[13px]" : "rounded-[13px]"} ${isDeleting ? "opacity-40" : ""} ${isDone ? "opacity-60" : ""}`}
                              >
                                {isCompleting ? (
                                  <Loader2 size={20} className="animate-spin text-brand flex-shrink-0" />
                                ) : isDone ? (
                                  <CheckCircle2 size={20} className="text-ca-success flex-shrink-0" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full border-2 border-ca-surface-input flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[15px] font-bold ${isDone ? "line-through text-ca-text-tertiary" : "text-gray-900"}`}>
                                    {step.title}
                                  </p>
                                  {step.deadline && !isDone && (
                                    <p className="text-xs text-ca-warn font-semibold mt-0.5">{tr.plan.deadline} {step.deadline}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => setConfirmDeleteStep(showDeleteConfirm ? null : step.serviceId)}
                                  className="p-0.5 text-ca-text-tertiary hover:text-ca-text-secondary transition-colors rounded flex-shrink-0"
                                  title={lang === "es" ? "Eliminar paso" : "Remove step"}
                                  disabled={isDeleting}
                                >
                                  <MoreHorizontal size={14} />
                                </button>
                              </div>
                              {showDeleteConfirm && (
                                <div className="bg-white border border-t-0 border-ca-surface-border rounded-b-[13px] px-5 py-2.5 flex items-center gap-2 text-xs">
                                  <Trash2 size={11} className="text-ca-danger flex-shrink-0" />
                                  <span className="text-ca-text-secondary">{lang === "es" ? "¿Eliminar este paso?" : "Remove this step?"}</span>
                                  <button onClick={() => handleDeleteStep(step)} className="text-ca-danger hover:opacity-80 font-semibold">
                                    {lang === "es" ? "Eliminar" : "Remove"}
                                  </button>
                                  <button onClick={() => setConfirmDeleteStep(null)} className="text-ca-text-tertiary hover:text-ca-text-secondary">
                                    {lang === "es" ? "Cancelar" : "Cancel"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        }

                        return (
                          <div
                            key={step.serviceId}
                            className={`bg-white border border-ca-surface-border border-l-[3px] border-l-brand rounded-[13px] px-5 py-4.5 shadow-[0_1px_3px_rgba(16,24,40,.05)] transition-opacity ${isDeleting ? "opacity-40" : ""}`}
                          >
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[15.5px] font-bold text-gray-900 leading-snug">
                                    {step.title}
                                  </p>
                                  <p className="text-xs text-ca-text-secondary mt-0.5">{step.agency}</p>
                                  <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {/* Phase 2a: tag which situation this step is for — only
                                        shown once there's more than one active situation, so a
                                        single-situation plan looks exactly as it did before. */}
                                    {activeSituationLabels.length > 1 && step.situation && (
                                      <span className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-md bg-brand-light text-brand">
                                        {tr.profile.lifeEvents[step.situation as keyof typeof tr.profile.lifeEvents] || step.situation}
                                      </span>
                                    )}
                                    {step.deadline && (
                                      <span className="text-xs font-semibold text-ca-warn">{tr.plan.deadline} {step.deadline}</span>
                                    )}
                                    {step.canDoOnline && step.onlineUrl && (
                                      <a
                                        href={step.onlineUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-ca-success-light text-ca-success hover:opacity-80 transition-opacity"
                                      >
                                        <ExternalLink size={9} />
                                        {lang === "es" ? "Hacer en línea" : "Do online"}
                                      </a>
                                    )}
                                  </div>
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
                                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-[9px] bg-brand text-white hover:bg-brand-dark transition-colors whitespace-nowrap"
                                    >
                                      {lang === "es" ? "Aplicar" : "Apply now"} →
                                    </a>
                                  ) : null
                                })()}
                                <button
                                  onClick={() => setConfirmDeleteStep(showDeleteConfirm ? null : step.serviceId)}
                                  className="p-0.5 text-ca-text-tertiary hover:text-ca-text-secondary transition-colors rounded"
                                  title={lang === "es" ? "Eliminar paso" : "Remove step"}
                                  disabled={isDeleting}
                                >
                                  <MoreHorizontal size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Inline delete confirm */}
                            {showDeleteConfirm && (
                              <div className="flex items-center gap-2 mt-2 text-xs py-1 border-b border-ca-surface-hairline">
                                <Trash2 size={11} className="text-ca-danger flex-shrink-0" />
                                <span className="text-ca-text-secondary">{lang === "es" ? "¿Eliminar este paso?" : "Remove this step?"}</span>
                                <button onClick={() => handleDeleteStep(step)} className="text-ca-danger hover:opacity-80 font-semibold">
                                  {lang === "es" ? "Eliminar" : "Remove"}
                                </button>
                                <button onClick={() => setConfirmDeleteStep(null)} className="text-ca-text-tertiary hover:text-ca-text-secondary">
                                  {lang === "es" ? "Cancelar" : "Cancel"}
                                </button>
                              </div>
                            )}

                            {/* Documents */}
                            {step.documents?.length > 0 && (
                              <div className="mt-3.5">
                                <p className="text-xs text-ca-text-secondary mb-1.5">{tr.plan.bringDocuments}</p>
                                <div className="flex flex-wrap gap-2">
                                  {step.documents.map((doc, di) => (
                                    <button
                                      key={di}
                                      onClick={() => handleDocInfo(doc)}
                                      className="inline-flex items-center gap-1 text-[12.5px] text-ca-text-secondary hover:text-brand transition-colors bg-white hover:bg-brand-light px-2.5 py-1 rounded-full border border-ca-surface-input hover:border-brand"
                                    >
                                      <Info size={9} />
                                      {doc}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* What to say — always open (this is the active step) */}
                            {step.whatToSayWhenYouArrive && (
                              <div className="mt-3.5 bg-brand-light rounded-[10px] p-3.5">
                                <p className="text-[12.5px] font-bold text-brand mb-1 flex items-center gap-1.5">
                                  <MessageSquare size={14} />
                                  {lang === "es" ? "Qué decir al llegar" : "What to say"}
                                </p>
                                <p className="text-[13px] text-gray-700 leading-relaxed break-words [overflow-wrap:anywhere]">&ldquo;{step.whatToSayWhenYouArrive}&rdquo;</p>
                              </div>
                            )}

                            {/* If problems — always open (this is the active step) */}
                            {step.whatToDoIfProblems && (
                              <div className="mt-2.5 bg-ca-warn-light border border-ca-warn-border rounded-[10px] p-3.5">
                                <p className="text-[12.5px] font-bold text-ca-warn mb-1 flex items-center gap-1.5">
                                  <AlertCircle size={14} />
                                  {lang === "es" ? "Si algo sale mal" : "If something goes wrong"}
                                </p>
                                <p className="text-[13px] text-ca-warn leading-relaxed break-words [overflow-wrap:anywhere]">{step.whatToDoIfProblems}</p>
                              </div>
                            )}

                            {/* Bottom row: Ask agent (left) + Mark as done (right) */}
                            <div className="flex items-center justify-between mt-4">
                              <button
                                onClick={() => handleAskAgent(step)}
                                className="text-[13px] font-semibold text-ca-text-secondary hover:text-brand transition-colors"
                              >
                                {lang === "es" ? "Preguntar al agente" : "Ask agent"}
                              </button>
                              <button
                                onClick={() => toggleStep(step, phase.phase)}
                                disabled={isCompleting || isDeleting}
                                className="flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-[9px] bg-white text-ca-success border border-ca-success-border hover:bg-ca-success-light transition-colors disabled:opacity-50"
                              >
                                {isCompleting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                {lang === "es" ? "Marcar como hecho" : "Mark as done"}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
