"use client"

import { Suspense, useState, useRef, useEffect, Fragment } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Send, Loader2, Sparkles } from "lucide-react"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import ChatMessage, { Message } from "@/components/chat/ChatMessage"
import MessageTemplates, { ConversationState } from "@/components/chat/MessageTemplates"
import ContextPills from "@/components/chat/ContextPills"
import ChatTour from "@/components/chat/ChatTour"
import { lookupServices, services as kbServices } from "@/lib/kb"
import { extractLifeEvent, extractEmployment } from "@/lib/extract-intent"
import { startRNPNDemoSequence, showFormPreview, showSubmissionFlow } from "@/lib/demo-sequence"

// Detect conversation state from the last agent message
function detectConversationState(messages: Message[]): ConversationState {
  const lastAgent = [...messages].reverse().find(m => m.role === "assistant" && m.content)
  if (!lastAgent || messages.filter(m => m.role === "user").length === 0) return "empty"
  const c = lastAgent.content.toLowerCase()
  if (c.includes("doc_info:") || (c.includes("document") && (c.includes("dui") || c.includes("certificate")))) {
    return "document-question"
  }
  if (c.includes("week 1") || c.includes("action plan") || c.includes("semana 1") || c.includes("plan de acción")) {
    return "plan-shown"
  }
  if (c.includes("apply_now:") || c.includes("rnpn") || c.includes("isss") || c.includes("maternity") || c.includes("maternidad")) {
    return "results-shown"
  }
  return "empty"
}

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function ChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang } = useLang()
  const { citizen, sessionId, refresh, isLoading: citizenLoading } = useCitizen()
  const tr = t(lang)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [entitlementCount, setEntitlementCount] = useState(0)
  const [showTour, setShowTour] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasAutoSentRef = useRef(false)
  // Prevents proactive greeting from firing immediately after onboarding completes
  const justCompletedOnboardingRef = useRef(false)
  // Set to true after the first real LLM message — prevents welcome effect from
  // resetting messages when citizen context refreshes after streaming ends
  const conversationStartedRef = useRef(false)

  // ── Conversational onboarding ─────────────────────────────────────
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [onboardingData, setOnboardingData] = useState({ situation: "", name: "", country: "", employment: "", email: "", gender: "" })
  const pendingEmailRef = useRef("")
  // Active when there is no logged-in citizen yet
  const isOnboarding = !citizenLoading && !citizen

  // Auto-send a message from ?msg= query param (used by plan page "I don't understand" button)
  // Fires once after the welcome message is set and the component is ready.
  useEffect(() => {
    const msgParam = searchParams.get("msg")
    if (!msgParam || hasAutoSentRef.current || streaming) return
    if (messages.length === 0) return // wait for welcome message to be set
    hasAutoSentRef.current = true
    // Small delay so the welcome message renders before the auto-send
    const t = setTimeout(() => sendMessage(decodeURIComponent(msgParam)), 400)
    return () => clearTimeout(t)
  }, [messages.length, streaming])

  // Show tour if flagged from onboarding
  useEffect(() => {
    const flag = localStorage.getItem("ca_show_tour")
    if (flag === "1") {
      // Small delay so the page renders first
      setTimeout(() => setShowTour(true), 600)
      localStorage.removeItem("ca_show_tour")
    }
  }, [])

  // Build welcome message based on context
  useEffect(() => {
    if (citizenLoading) return // wait for auth check before deciding onboarding vs regular
    if (conversationStartedRef.current) return // don't reset mid-conversation
    if (justCompletedOnboardingRef.current) return // onboarding handles its own post-completion message
    const preload = searchParams.get("context")

    if (preload) {
      setMessages([{
        id: generateId(), role: "assistant",
        content: lang === "es" ? `Hola! Sobre **${preload}**: ¿en qué te puedo ayudar?` : `Hi! About **${preload}**: how can I help you?`,
      }])
      return
    }

    // ── Conversational onboarding — no citizenId yet ─────────────────
    if (!citizen) {
      setOnboardingStep(0)
      setMessages([{
        id: generateId(), role: "assistant",
        content: lang === "es"
          ? "¡Hola! Soy Citizen Assist — encuentro todos los beneficios del gobierno de El Salvador para los que calificás, y te ayudo a tramitarlos. ¿En qué te puedo ayudar hoy?"
          : "Hi! I'm Citizen Assist — I find every government benefit you qualify for in El Salvador, and help you claim them. What can I help you with today?",
        actionButtons: [
          { label: lang === "es" ? "🍼 Acabo de tener un bebé"       : "🍼 I just had a baby",              action: "ob:situation:new-baby",       variant: "outline" },
          { label: lang === "es" ? "💼 Perdí mi trabajo"              : "💼 I lost my job",                  action: "ob:situation:job-loss",        variant: "outline" },
          { label: lang === "es" ? "🏪 Quiero registrar un negocio"   : "🏪 I want to register a business",  action: "ob:situation:start-business",  variant: "outline" },
          { label: lang === "es" ? "🌎 Necesito ayuda desde el exterior" : "🌎 I need help from abroad",    action: "ob:situation:diaspora",        variant: "outline" },
        ],
      }])
      return
    }

    // ── Returning citizen with life event ────────────────────────────
    if (citizen?.profile.lifeEvent) {
      const svcs = lookupServices({ country: citizen.profile.country, lifeEvent: citizen.profile.lifeEvent, employment: citizen.profile.employment || "any" })
      setEntitlementCount(svcs.length)
      if (svcs.length > 0) {
        const urgentSvc = svcs.find(s => s.deadlineDays && s.deadlineDays <= 30)

        // Empathetic opener based on life event
        const empathyEn: Record<string, string> = {
          "new-baby":       "Congratulations on your new baby! 🎉 ",
          "job-loss":       "I'm sorry to hear about your job loss — I'm here to help. 💙 ",
          "start-business": "Exciting to hear you're starting a business! 🚀 ",
          "diaspora":       "Happy to help you manage things from abroad. 🌎 ",
        }
        const empathyEs: Record<string, string> = {
          "new-baby":       "¡Felicitaciones por tu bebé! 🎉 ",
          "job-loss":       "Lamento mucho lo de tu trabajo — estoy acá para ayudarte. 💙 ",
          "start-business": "¡Qué emocionante que estés arrancando tu negocio! 🚀 ",
          "diaspora":       "Con gusto te ayudo a gestionar todo desde el exterior. 🌎 ",
        }
        const opener = lang === "es"
          ? (empathyEs[citizen.profile.lifeEvent] || "")
          : (empathyEn[citizen.profile.lifeEvent] || "")

        setMessages([{
          id: generateId(), role: "assistant",
          content: lang === "es"
            ? `${opener}Hola **${citizen.profile.firstName}**, encontré **${svcs.length} beneficios** para tu situación.${urgentSvc ? ` El más urgente: **${urgentSvc.deadlineDays} días** para registrarte en ${urgentSvc.agency}.` : ""} ¿Querés ver el plan?`
            : `${opener}Hi **${citizen.profile.firstName}**, I found **${svcs.length} benefits** for your situation.${urgentSvc ? ` Most urgent: **${urgentSvc.deadlineDays} days** to register at ${urgentSvc.agency}.` : ""} Want to see the plan?`,
          actionButtons: [
            { label: tr.chat.viewBenefits(svcs.length), action: "view-benefits", variant: "outline" },
            { label: tr.chat.openPlan, action: "open-plan", variant: "green" },
          ],
        }])
        return
      }
    }

    setMessages([{ id: generateId(), role: "assistant", content: tr.chat.welcome }])
  }, [citizen?.profile.lifeEvent, lang, citizenLoading])

  // Proactive greeting for returning citizens — no API call, message appears instantly
  useEffect(() => {
    if (!citizen || citizenLoading) return
    if (messages.length > 0) return // only on fresh load

    // Don't fire right after onboarding — the welcome-message effect already shows benefits
    if (justCompletedOnboardingRef.current) {
      justCompletedOnboardingRef.current = false
      return
    }

    const { lifeEvent, firstName, language } = citizen.profile
    const deadlines = citizen.deadlines || []
    const planSteps = citizen.planSteps || []
    const entitlements = citizen.entitlements || []
    const isEs = language === "es"

    if (!lifeEvent) return // new user — existing generic greeting handles this

    // Find most urgent upcoming deadline
    const upcoming = deadlines
      .filter(d => !d.completed && new Date(d.dueDate) > new Date())
      .sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      )[0]

    const daysLeft = upcoming
      ? Math.ceil(
          (new Date(upcoming.dueDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
        )
      : null

    // Find next incomplete step
    const nextStep = planSteps.find(s => s.status !== "done")

    // Count unclaimed
    const unclaimed = entitlements.filter(e => e.status === "new").length

    // Only fire proactive if there is something meaningful to show.
    // New citizens (no plan, no urgent deadlines) should not see this.
    const hasUrgentDeadline = daysLeft !== null && daysLeft <= 7
    const hasPlanStep = !!(nextStep?.serviceName || nextStep?.serviceId)
    const hasUnclaimed = unclaimed > 0
    if (!hasUrgentDeadline && !hasPlanStep && !hasUnclaimed) return

    let greeting: string | null = null

    if (hasUrgentDeadline) {
      greeting = isEs
        ? `Hola de nuevo, ${firstName}. ⚠️ Quedan **${daysLeft} días** para completar: ${upcoming!.titleEs}. ¿Querés que te explique exactamente qué necesitás hacer?`
        : `Welcome back, ${firstName}. ⚠️ You have **${daysLeft} days** left to complete: ${upcoming!.title}. Want me to walk you through exactly what to do?`
    } else if (hasPlanStep) {
      // Look up the real name from the KB — plan may have stored serviceId as serviceName
      const kbSvc = kbServices.find(k => k.id === nextStep!.serviceId)
      const stepName   = kbSvc?.name   || nextStep!.serviceName   || nextStep!.serviceId
      const stepNameEs = kbSvc?.nameEs || nextStep!.serviceNameEs || stepName
      greeting = isEs
        ? `Hola de nuevo, ${firstName}. Tu próximo paso es **${stepNameEs}**. ¿Querés que te prepare para hacerlo?`
        : `Welcome back, ${firstName}. Your next step is **${stepName}**. Want me to get you ready for it?`
    } else {
      greeting = isEs
        ? `Hola de nuevo, ${firstName}. Todavía tenés **${unclaimed} beneficio${unclaimed > 1 ? 's' : ''}** sin reclamar. ¿Empezamos?`
        : `Welcome back, ${firstName}. You still have **${unclaimed} unclaimed benefit${unclaimed > 1 ? 's' : ''}**. Want to get started?`
    }

    if (!greeting) return

    // Inject as first message — no API call, no streaming
    setMessages([{
      id: `proactive_${Date.now()}`,
      role: "assistant",
      content: greeting,
    }])
  }, [citizen, citizenLoading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Onboarding chip handler ──────────────────────────────────────
  const handleOnboardingAction = async (action: string) => {
    const [, stepType, value] = action.split(":")  // "ob:situation:new-baby" → ["ob","situation","new-baby"]
    const addUserMsg = (text: string) =>
      setMessages(prev => [...prev, { id: generateId(), role: "user", content: text }])
    const addAgentMsg = (content: string, buttons?: Message["actionButtons"]) =>
      setMessages(prev => [...prev, { id: generateId(), role: "assistant", content, actionButtons: buttons }])

    if (stepType === "situation") {
      const labels: Record<string, string> = {
        "new-baby":       lang === "es" ? "Acabo de tener un bebé"        : "I just had a baby",
        "job-loss":       lang === "es" ? "Perdí mi trabajo"               : "I lost my job",
        "start-business": lang === "es" ? "Quiero registrar un negocio"    : "I want to register a business",
        "diaspora":       lang === "es" ? "Necesito ayuda desde el exterior": "I need help from abroad",
      }
      setOnboardingData(prev => ({ ...prev, situation: value }))
      localStorage.setItem("ca_detected_life_event", value)
      addUserMsg(labels[value] || value)
      setOnboardingStep(1)
      setTimeout(() => addAgentMsg(lang === "es" ? "Entendido. ¿Cómo te llamás?" : "Got it. What's your name?"), 400)
      return
    }

    if (stepType === "country") {
      const countryLabels: Record<string, string> = { SV: "🇸🇻 El Salvador", US: "🇺🇸 United States", UK: "🇬🇧 United Kingdom", other: lang === "es" ? "📍 Otro lugar" : "📍 Somewhere else" }
      setOnboardingData(prev => ({ ...prev, country: value }))
      addUserMsg(countryLabels[value] || value)

      // For job-loss: skip the employment question — they're unemployed by context
      if (onboardingData.situation === "job-loss") {
        setOnboardingData(prev => ({ ...prev, country: value, employment: "unemployed" }))
        localStorage.setItem("ca_detected_employment", "unemployed")
        setOnboardingStep(4)
        setTimeout(() => addAgentMsg(
          lang === "es"
            ? "Última cosa — ¿cuál es tu email? Lo uso para recordatorios de plazos. Podés saltearlo."
            : "Last thing — what's your email? I'll use it for deadline reminders. You can skip this.",
          [{ label: lang === "es" ? "Saltear por ahora" : "Skip for now", action: "ob:email:skip", variant: "outline" }]
        ), 400)
        return
      }

      setOnboardingStep(3)
      // Show disabled DUI card + employment chips
      setTimeout(() => {
        addAgentMsg(
          lang === "es"
            ? "🔒 **Login con DUI** — Próximamente · Verificación de identidad instantánea\n\nPor ahora, contame tu situación laboral:"
            : "🔒 **Login with DUI** — Coming soon · Instant identity verification\n\nFor now, tell me your employment situation:",
          [
            { label: lang === "es" ? "💼 Empleado formal"       : "💼 Formally employed",    action: "ob:employment:employed",   variant: "outline" },
            { label: lang === "es" ? "🏠 Cuenta propia"         : "🏠 Self-employed",         action: "ob:employment:informal",   variant: "outline" },
            { label: lang === "es" ? "🔍 Sin trabajo"           : "🔍 Currently unemployed",  action: "ob:employment:unemployed", variant: "outline" },
            { label: lang === "es" ? "🌿 Sector informal"       : "🌿 Informal sector",       action: "ob:employment:informal",   variant: "outline" },
          ]
        )
      }, 400)
      return
    }

    if (stepType === "employment") {
      const empLabels: Record<string, string> = { employed: lang === "es" ? "Empleado formal" : "Formally employed", unemployed: lang === "es" ? "Sin trabajo" : "Unemployed", informal: lang === "es" ? "Sector informal" : "Informal / self-employed" }
      setOnboardingData(prev => ({ ...prev, employment: value }))
      localStorage.setItem("ca_detected_employment", value)
      addUserMsg(empLabels[value] || value)
      setOnboardingStep(4)
      setTimeout(() => addAgentMsg(
        lang === "es" ? "Última cosa — ¿cuál es tu email? Lo uso para recordatorios de plazos. Podés saltearlo." : "Last thing — what's your email? I'll use it for deadline reminders. You can skip this.",
        [{ label: lang === "es" ? "Saltear por ahora" : "Skip for now", action: "ob:email:skip", variant: "outline" }]
      ), 400)
      return
    }

    if (stepType === "email") {
      const emailValue = value === "skip" ? "" : value
      setOnboardingData(prev => ({ ...prev, email: emailValue }))
      if (value !== "skip") addUserMsg(value)
      pendingEmailRef.current = emailValue
      setOnboardingStep(5)
      setTimeout(() => addAgentMsg(
        lang === "es"
          ? "Una última cosa — ¿cuál es tu género? Ayuda a encontrar beneficios específicos. Podés saltearlo."
          : "One last thing — what's your gender? Helps find gender-specific benefits. You can skip this.",
        [
          { label: lang === "es" ? "👩 Femenino"         : "👩 Female",           action: "ob:gender:female", variant: "outline" },
          { label: lang === "es" ? "👨 Masculino"        : "👨 Male",             action: "ob:gender:male",   variant: "outline" },
          { label: lang === "es" ? "⬜ Prefiero no decir" : "⬜ Prefer not to say", action: "ob:gender:no-say", variant: "outline" },
          { label: lang === "es" ? "Saltear"             : "Skip",                action: "ob:gender:skip",  variant: "outline" },
        ]
      ), 400)
      return
    }

    if (stepType === "gender") {
      const genderValue = value === "skip" ? "" : value
      setOnboardingData(prev => ({ ...prev, gender: genderValue }))
      const genderLabels: Record<string, string> = {
        female:   lang === "es" ? "Femenino"          : "Female",
        male:     lang === "es" ? "Masculino"         : "Male",
        "no-say": lang === "es" ? "Prefiero no decir" : "Prefer not to say",
      }
      if (genderValue && genderValue !== "skip") addUserMsg(genderLabels[genderValue] || genderValue)
      await completeOnboarding(pendingEmailRef.current, genderValue)
      return
    }
  }

  // Finalize onboarding — create citizen, save context, show benefits
  // emailArg bypasses stale-state timing: setOnboardingData is async, so we
  // pass the email value directly from the call site instead of reading from state
  const completeOnboarding = async (emailArg?: string, genderArg?: string) => {
    const { situation, name, country, employment } = onboardingData
    const email  = emailArg  !== undefined ? emailArg  : onboardingData.email
    const gender = genderArg !== undefined ? genderArg : onboardingData.gender
    setMessages(prev => [...prev, {
      id: generateId(), role: "assistant",
      content: lang === "es" ? "Perfecto. Buscando tus beneficios..." : "Perfect. Finding your benefits...",
    }])
    try {
      const res = await fetch("/api/citizen/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: name, country: country || "SV", email, gender: gender || "", language: lang }),
      })
      const data = await res.json()
      if (data.citizenId) {
        localStorage.setItem("ca_citizen_id", data.citizenId)
        localStorage.setItem("ca_show_tour", "1")  // auto-show tour for first-time users
        document.cookie = `ca_citizen_id=${data.citizenId}; max-age=31536000; path=/; SameSite=Lax`
      }
      if (situation && data.citizenId) {
        await fetch("/api/context/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ citizenId: data.citizenId, lifeEvent: situation, employment: employment || "any", entitlements: [] }),
        })
      }
      justCompletedOnboardingRef.current = true  // block welcome effect from replacing conversation
      const fresh = await refresh()

      // Append benefits message directly so the onboarding conversation stays visible
      if (fresh?.profile.lifeEvent) {
        const svcs = lookupServices({
          country: fresh.profile.country || "SV",
          lifeEvent: fresh.profile.lifeEvent,
          employment: fresh.profile.employment || "any",
        })
        setEntitlementCount(svcs.length)
        if (svcs.length > 0) {
          const urgentSvc = svcs.find((s: { deadlineDays?: number }) => s.deadlineDays && s.deadlineDays <= 30)
          const lifeEvent = fresh.profile.lifeEvent
          const empathyEn: Record<string, string> = {
            "new-baby":       "Congratulations on your new baby! 🎉 ",
            "job-loss":       "I'm sorry to hear about your job loss — I'm here to help. 💙 ",
            "start-business": "Exciting to hear you're starting a business! 🚀 ",
            "diaspora":       "Happy to help you manage things from abroad. 🌎 ",
          }
          const empathyEs: Record<string, string> = {
            "new-baby":       "¡Felicitaciones por tu bebé! 🎉 ",
            "job-loss":       "Lamento mucho lo de tu trabajo — estoy acá para ayudarte. 💙 ",
            "start-business": "¡Qué emocionante que estés arrancando tu negocio! 🚀 ",
            "diaspora":       "Con gusto te ayudo a gestionar todo desde el exterior. 🌎 ",
          }
          const opener = lang === "es" ? (empathyEs[lifeEvent] || "") : (empathyEn[lifeEvent] || "")
          setMessages(prev => [...prev, {
            id: generateId(), role: "assistant",
            content: lang === "es"
              ? `${opener}Encontré **${svcs.length} beneficios** para tu situación.${urgentSvc ? ` El más urgente: **${urgentSvc.deadlineDays} días** para registrarte en ${urgentSvc.agency}.` : ""} ¿Querés ver el plan?`
              : `${opener}I found **${svcs.length} benefits** for your situation.${urgentSvc ? ` Most urgent: **${urgentSvc.deadlineDays} days** to register at ${urgentSvc.agency}.` : ""} Want to see the plan?`,
            actionButtons: [
              { label: tr.chat.viewBenefits(svcs.length), action: "view-benefits", variant: "outline" },
              { label: tr.chat.openPlan, action: "open-plan", variant: "green" },
            ],
          }])
        }
      }
    } catch (e) {
      console.error("Onboarding failed:", e)
    }
  }

  // ── Agentic demo handlers ─────────────────────────────────────────
  const handleApplyNow = (serviceId: string) => {
    if (serviceId !== "sv-rnpn-birth-registration") return
    startRNPNDemoSequence(
      citizen?.profile?.firstName || "",
      lang,
      (msg) => setMessages(prev => [...prev, msg]),
      (id, activities) => setMessages(prev => prev.map(m => m.id === id ? { ...m, activities } : m))
    )
  }

  const handleDocAction = (msgId: string, action: string, value?: string) => {
    // Mark the doc-request card as resolved
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, resolved: true } : m))
    if (action === "type" && value) {
      setMessages(prev => [...prev, { id: generateId(), role: "user", content: value }])
      setTimeout(() => {
        showFormPreview(value, citizen?.profile?.firstName || "", lang, (msg) => setMessages(prev => [...prev, msg]))
      }, 400)
    }
  }

  const handleFormConfirm = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, submitted: true } : m))
    showSubmissionFlow(lang, (msg) => setMessages(prev => [...prev, msg]))
  }

  const handleConfirmation = (msgId: string, value: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, resolved: true } : m))
    if (value === "yes") {
      setMessages(prev => [...prev, { id: generateId(), role: "user", content: lang === "es" ? "Sí, empezá" : "Yes, start it" }])
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: generateId(), role: "assistant",
          content: lang === "es"
            ? "Perfecto. Preparando el formulario de inscripción del ISSS para tu bebé. Te aviso cuando esté listo."
            : "Perfect. Preparing the ISSS enrollment form for your baby. I'll let you know when it's ready.",
        }])
      }, 800)
    }
  }

  const handleAction = async (action: string) => {
    // Route onboarding chip actions
    if (action.startsWith("ob:")) { await handleOnboardingAction(action); return }

    if (action === "open-plan") {
      setGeneratingPlan(true)
      try {
        // Try to get fresh DB citizen data (works for logged-in users)
        const fresh = await refresh()
        const ctx = fresh || citizen

        // For lifeEvent/employment: prefer DB values, fall back to localStorage signals
        // captured from the chat messages (works for anonymous/new users too)
        const lifeEvent  = ctx?.profile.lifeEvent  || localStorage.getItem("ca_detected_life_event")  || ""
        const employment = ctx?.profile.employment  || localStorage.getItem("ca_detected_employment")  || "any"
        const country    = ctx?.profile.country     || "SV"
        const citizenId  = ctx?.citizenId

        console.log("Open plan → lifeEvent:", lifeEvent, "employment:", employment, "citizenId:", citizenId)

        // Regenerate plan if: no steps yet, OR plan is stale (life event changed)
        const planIsStale = !!(ctx?.planLifeEvent && ctx.planLifeEvent !== lifeEvent)
        const needsPlan = lifeEvent && citizenId && (!ctx?.planSteps?.length || planIsStale)

        if (needsPlan) {
          const svcs = lookupServices({ country, lifeEvent, employment })
          console.log("Services found:", svcs.length)
          if (svcs.length > 0) {
            // Always inject the resolved lifeEvent/employment so the plan is
            // saved with the correct life event even if DB hasn't been updated yet
            const profile = {
              firstName: ctx?.profile?.firstName || "there",
              country,
              lifeEvent,       // resolved value, not raw DB value (which may be "")
              employment,
              language: (ctx?.profile?.language || lang) as "en" | "es",
            }
            const res = await fetch("/api/plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ citizenId, services: svcs, profile, language: lang }),
            })
            if (!res.ok) {
              console.error("Plan generation failed:", res.status, await res.text())
            } else {
              // Refresh citizen AFTER plan is saved so the plan page sees planSteps
              // and uses the cached plan instead of re-generating
              await refresh()
            }
          }
        }
      } catch (e) {
        console.error("Plan pre-generation failed:", e)
      } finally {
        setGeneratingPlan(false)
      }
      router.push("/plan")
      return
    }
    if (action === "view-benefits") sendMessage(tr.chat.viewBenefits(entitlementCount))
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return

    // ── Handle onboarding free-text steps ───────────────────────────
    if (isOnboarding) {
      if (onboardingStep === 1) {
        // Collecting name — always El Salvador, skip country question
        const nameVal = text.trim()
        const isJobLoss = onboardingData.situation === "job-loss"
        setOnboardingData(prev => ({
          ...prev,
          name: nameVal,
          country: "SV",
          ...(isJobLoss ? { employment: "unemployed" } : {}),
        }))
        if (isJobLoss) localStorage.setItem("ca_detected_employment", "unemployed")
        setMessages(prev => [...prev, { id: generateId(), role: "user", content: nameVal }])
        setInput("")

        if (isJobLoss) {
          // Job loss → skip employment, go straight to email
          setOnboardingStep(4)
          setTimeout(() => setMessages(prev => [...prev, {
            id: generateId(), role: "assistant",
            content: lang === "es"
              ? "Última cosa — ¿cuál es tu email? Lo uso para recordatorios de plazos. Podés saltearlo."
              : "Last thing — what's your email? I'll use it for deadline reminders. You can skip this.",
            actionButtons: [{ label: lang === "es" ? "Saltear por ahora" : "Skip for now", action: "ob:email:skip", variant: "outline" }],
          }]), 400)
        } else {
          // Show employment options
          setOnboardingStep(3)
          setTimeout(() => setMessages(prev => [...prev, {
            id: generateId(), role: "assistant",
            content: lang === "es"
              ? `Mucho gusto, ${nameVal}. ¿Cuál es tu situación laboral?`
              : `Nice to meet you, ${nameVal}. What's your employment situation?`,
            actionButtons: [
              { label: lang === "es" ? "💼 Empleado formal"    : "💼 Formally employed",   action: "ob:employment:employed",   variant: "outline" },
              { label: lang === "es" ? "🏠 Cuenta propia"      : "🏠 Self-employed",        action: "ob:employment:informal",   variant: "outline" },
              { label: lang === "es" ? "🔍 Sin trabajo"        : "🔍 Currently unemployed", action: "ob:employment:unemployed", variant: "outline" },
              { label: lang === "es" ? "🌿 Sector informal"    : "🌿 Informal sector",      action: "ob:employment:informal",   variant: "outline" },
            ],
          }]), 400)
        }
        return
      }
      if (onboardingStep === 4) {
        // Collecting email — show gender question next instead of completing immediately
        const emailVal = text.trim()
        setOnboardingData(prev => ({ ...prev, email: emailVal }))
        setMessages(prev => [...prev, { id: generateId(), role: "user", content: emailVal }])
        setInput("")
        pendingEmailRef.current = emailVal
        setOnboardingStep(5)
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: generateId(), role: "assistant",
            content: lang === "es"
              ? "Una última cosa — ¿cuál es tu género? Ayuda a encontrar beneficios específicos."
              : "One last thing — what's your gender? Helps find gender-specific benefits.",
            actionButtons: [
              { label: lang === "es" ? "👩 Femenino"          : "👩 Female",           action: "ob:gender:female", variant: "outline" },
              { label: lang === "es" ? "👨 Masculino"         : "👨 Male",             action: "ob:gender:male",   variant: "outline" },
              { label: lang === "es" ? "⬜ Prefiero no decir"  : "⬜ Prefer not to say", action: "ob:gender:no-say", variant: "outline" },
              { label: lang === "es" ? "Saltear"              : "Skip",                action: "ob:gender:skip",   variant: "outline" },
            ],
          }])
        }, 400)
        return
      }
      // For any other onboarding step, treat as "something else" → complete with what we have
      if (onboardingStep === 0) {
        // "Something else" free text → treat as situation description
        setOnboardingData(prev => ({ ...prev, situation: "" }))
        setMessages(prev => [...prev, { id: generateId(), role: "user", content: text.trim() }])
        setInput("")
        setOnboardingStep(1)
        setTimeout(() => setMessages(prev => [...prev, { id: generateId(), role: "assistant", content: lang === "es" ? "Entendido. ¿Cómo te llamás?" : "Got it. What's your name?" }]), 400)
        return
      }
    }

    // Mark conversation as started — prevents welcome effect from resetting messages
    conversationStartedRef.current = true

    // Detect context signals from the user's message and persist them locally.
    // This is the only way to carry lifeEvent/employment to the plan page for
    // anonymous users who haven't gone through onboarding (no DB record).
    const detectedLifeEvent  = extractLifeEvent(text)
    const detectedEmployment = extractEmployment(text)
    if (detectedLifeEvent)  localStorage.setItem("ca_detected_life_event",  detectedLifeEvent)
    if (detectedEmployment) localStorage.setItem("ca_detected_employment",   detectedEmployment)

    const userMsg: Message = { id: generateId(), role: "user", content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput("")
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
    setStreaming(true)

    const assistantId = generateId()
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          citizenId: citizen?.citizenId,
          contextData: citizen,
          sessionId,
          language: lang,
        }),
      })

      if (!res.ok) throw new Error("Chat failed")

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)
        )
      }

      // Show "Open plan" button whenever the agent surfaced any service.
      // APPLY_NOW: is present in every benefit card response, plus catch
      // plain-text mentions of common benefit/plan keywords.
      const lower = fullText.toLowerCase()
      const hasServices =
        lower.includes("apply_now:") ||
        lower.includes("plan") ||
        lower.includes("benefit") ||
        lower.includes("benefici") ||
        lower.includes("subsidy") ||
        lower.includes("prestaci") ||
        lower.includes("registro") ||
        lower.includes("registration")
      if (hasServices) {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? {
            ...m,
            actionButtons: [{ label: tr.chat.openPlan, action: "open-plan", variant: "green" }]
          } : m)
        )
      }
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: tr.common.error } : m)
      )
    } finally {
      setStreaming(false)
      // Refresh citizen context so lifeEvent/employment detected this turn are visible
      // immediately — needed for the "Open plan" button to see the correct lifeEvent.
      const citizenId = localStorage.getItem("ca_citizen_id")
      if (citizenId) refresh().catch(() => {})
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const conversationState = detectConversationState(messages)
  // Area 5C: verify state transitions are firing correctly
  if (typeof window !== "undefined") console.log("[chat] conversationState:", conversationState)

  const greeting = (() => {
    const name = citizen?.profile.firstName
    if (!name || name === "there") return null
    const h = new Date().getHours()
    const tod = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
    return `${tod}, ${name}`
  })()

  return (
    <>
      {/* Tour overlay */}
      {showTour && <ChatTour onDone={() => setShowTour(false)} />}

      <div className="flex flex-col h-screen bg-gray-50">

        {/* Greeting header — shows when citizen is known */}
        {greeting && (
          <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">{greeting}</p>
              {citizen?.profile.lifeEvent && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {entitlementCount > 0
                    ? `${entitlementCount} benefits found · El Salvador`
                    : "El Salvador"}
                </p>
              )}
            </div>
            <a href="/preview" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-colors">
              <Sparkles size={12} />Preview
            </a>
          </div>
        )}

        {/* Context pills */}
        {citizen && (
          <div data-tour="context-pills">
            <ContextPills citizen={citizen} />
          </div>
        )}

        {/* Message list — dot-grid wallpaper in Sivar yellow */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          style={{
            backgroundColor: "#F5F7FA",
            backgroundImage:
              "radial-gradient(circle, rgba(255,196,0,0.45) 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        >
          {messages.map((msg, idx) => {
            // Show suggestion chips directly below the last assistant message
            const isLastAssistant =
              msg.role === "assistant" &&
              !messages.slice(idx + 1).some(m => m.role === "assistant")
            return (
              <Fragment key={msg.id}>
                <ChatMessage
                  message={msg}
                  citizenId={citizen?.citizenId}
                  onAction={handleAction}
                  onSendMessage={sendMessage}
                  onApplyNow={handleApplyNow}
                  onDocAction={handleDocAction}
                  onFormConfirm={handleFormConfirm}
                  onConfirmation={handleConfirmation}
                  dataTour={idx === 0 && msg.role === "assistant" ? "agent-message" : undefined}
                />
                {isLastAssistant && !isOnboarding && !streaming && (
                  <div data-tour="templates">
                    <MessageTemplates
                      conversationState={conversationState}
                      language={lang}
                      onSelect={sendMessage}
                      disabled={streaming || generatingPlan}
                    />
                  </div>
                )}
              </Fragment>
            )
          })}

          {streaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-gray-100">
          {/* Generating plan banner */}
          {generatingPlan && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-[#1B3A8C]">
              <Sparkles size={12} className="animate-pulse" />
              {lang === "es" ? "Generando tu plan..." : "Generating your plan..."}
            </div>
          )}

          <div data-tour="input-bar" className="flex items-end gap-2 px-4 pt-3 pb-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tr.chat.placeholder}
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-full px-5 py-2.5 text-sm focus:outline-none focus:border-[#FFC400] focus:ring-2 focus:ring-yellow-50 transition-all max-h-32 bg-white"
              onInput={e => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 128) + "px"
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FFC400] hover:bg-[#E5AF00] text-yellow-900 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {streaming
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={16} />}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 pb-2 px-4">
            Citizen Assist can make mistakes. Verify important information with the relevant government agency.
          </p>
        </div>
      </div>
    </>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFC400]" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
