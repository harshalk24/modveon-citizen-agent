"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Send, Loader2, Sparkles } from "lucide-react"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import ChatMessage, { Message } from "@/components/chat/ChatMessage"
import MessageTemplates, { ConversationState } from "@/components/chat/MessageTemplates"
import ContextPills from "@/components/chat/ContextPills"
import ChatTour from "@/components/chat/ChatTour"
import { lookupServices } from "@/lib/kb"
import { extractLifeEvent, extractEmployment } from "@/lib/extract-intent"

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
  const { citizen, sessionId, refresh } = useCitizen()
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
    const preload = searchParams.get("context")

    if (preload) {
      setMessages([{
        id: generateId(),
        role: "assistant",
        content: lang === "es"
          ? `Hola! Sobre **${preload}**: ¿en qué te puedo ayudar?`
          : `Hi! About **${preload}**: how can I help you?`,
      }])
      return
    }

    if (citizen?.profile.lifeEvent) {
      const svcs = lookupServices({
        country: citizen.profile.country,
        lifeEvent: citizen.profile.lifeEvent,
        employment: citizen.profile.employment || "any",
      })
      setEntitlementCount(svcs.length)
      if (svcs.length > 0) {
        const urgentSvc = svcs.find(s => s.deadlineDays && s.deadlineDays <= 30)
        setMessages([{
          id: generateId(),
          role: "assistant",
          content: lang === "es"
            ? `Hola **${citizen.profile.firstName}**. Basándome en tu situación, encontré **${svcs.length} beneficios** que te corresponden.${urgentSvc ? ` El más urgente: tenés **${urgentSvc.deadlineDays} días** para registrarte en el ${urgentSvc.agency}. ¿Querés ver el plan completo?` : " ¿Querés ver el plan completo?"}`
            : `Hi **${citizen.profile.firstName}**. Based on your situation, I found **${svcs.length} benefits** you qualify for.${urgentSvc ? ` Most urgent: you have **${urgentSvc.deadlineDays} days** to register at ${urgentSvc.agency}. Want to see the full plan?` : " Want to see the full plan?"}`,
          actionButtons: [
            { label: tr.chat.viewBenefits(svcs.length), action: "view-benefits", variant: "outline" },
            { label: tr.chat.openPlan, action: "open-plan", variant: "green" },
          ],
        }])
        return
      }
    }

    setMessages([{ id: generateId(), role: "assistant", content: tr.chat.welcome }])
  }, [citizen?.profile.lifeEvent, lang])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleAction = async (action: string) => {
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

        if (lifeEvent && !ctx?.planSteps?.length) {
          const svcs = lookupServices({ country, lifeEvent, employment })
          console.log("Services found:", svcs.length)
          if (svcs.length > 0) {
            const profile = ctx?.profile || {
              firstName: "there", country, lifeEvent, employment, language: lang as "en" | "es"
            }
            await fetch("/api/plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ citizenId, services: svcs, profile, language: lang }),
            })
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
          </div>
        )}

        {/* Context pills */}
        {citizen && (
          <div data-tour="context-pills">
            <ContextPills citizen={citizen} />
          </div>
        )}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, idx) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              citizenId={citizen?.citizenId}
              onAction={handleAction}
              onSendMessage={sendMessage}
              dataTour={idx === 0 && msg.role === "assistant" ? "agent-message" : undefined}
            />
          ))}

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
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-[#185FA5]">
              <Sparkles size={12} className="animate-pulse" />
              {lang === "es" ? "Generando tu plan..." : "Generating your plan..."}
            </div>
          )}

          <div data-tour="templates">
            <MessageTemplates
              conversationState={conversationState}
              language={lang}
              onSelect={sendMessage}
              disabled={streaming || generatingPlan}
            />
          </div>

          <div data-tour="input-bar" className="flex items-end gap-2 px-4 pt-3 pb-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tr.chat.placeholder}
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#185FA5] focus:ring-2 focus:ring-blue-50 transition-all max-h-32 bg-white"
              onInput={e => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 128) + "px"
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#185FA5] hover:bg-[#145290] text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#185FA5]" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
