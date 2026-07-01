"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { ArrowUp } from "lucide-react"
import { useRouter } from "next/navigation"

let _id = 0
const uid   = (p = "b") => `${p}_${++_id}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  canvas:     "#F8F6F1",
  card:       "#FFFFFF",
  raised:     "#F3EEE5",
  border:     "#EAE5DB",
  border2:    "#E0DACE",
  hair:       "#F0ECE2",
  line:       "#ECE6DC",
  ink:        "#1E3550",
  body:       "#3A4656",
  muted:      "#6A7280",
  faint:      "#9AA0A8",
  accent:     "#B0524A",
  accentD:    "#974640",
  accentSoft: "#F4E4E0",
  ok:         "#3C7D5A",
  okT:        "#326B4D",
  okBg:       "#E7F1EB",
  okBd:       "#D2E5D8",
  alert:      "#B58233",
  alertT:     "#8E6627",
  alertBg:    "#F6EFD9",
  alertBd:    "#E7DCB8",
  info:       "#35618C",
  infoBg:     "#E7EDF4",
  infoBd:     "#D0DCEB",
  sandBg:     "#F6E7E2",
  chipBg:     "#F1EDE4",
  sky:        "#7FA8C9",
}

interface Activity { id: string; label: string; status: "running" | "waiting" | "done"; detail?: string }
interface Message  { id: string; type: string; content?: string; activities?: Activity[]; isComplete?: boolean; step?: typeof STEPS[0] }

// ── Data ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: "work-permit-card",
    name: "Step 1 — Collect your Work Permit Card",
    desc: "Visit the Department of Immigration at the Government Administration Building, 30 Parliament Street, Hamilton. Bring your original work permit approval letter — photocopies are turned away at the door. Counter service: Mon–Fri 9:00am–4:00pm. This card unlocks every step that follows.",
    value: "USD 160 · Week 1", mode: "in-person" as const, url: null, urgent: true,
  },
  {
    id: "social-insurance",
    name: "Step 2 — Register for Social Insurance",
    desc: "Register online after collecting your Work Permit Card (Step 1 must be done first). Your employer is also legally required to register and contribute from your very first week of work — confirm this with HR on day one.",
    value: "Free · Week 1", mode: "online" as const, url: "https://www2.gov.bm/department/social-insurance", urgent: true,
  },
  {
    id: "health-insurance",
    name: "Step 3 — Confirm Health Insurance enrolment",
    desc: "Your employer must cover at least 50% of your Standard Health Benefit (SHB) premium under the Health Insurance Act 1970. Ask HR for written confirmation on your first day. If not enrolled by day 30, you can register directly with the Health Insurance Department.",
    value: "Employer-covered · Within 30 days", mode: "online" as const, url: "https://www2.gov.bm/department/health-insurance", urgent: false,
  },
  {
    id: "assessment-number",
    name: "Step 4 — Get the Assessment Number for your lease",
    desc: "Before signing any tenancy agreement, ask your landlord for the property's Assessment Number. It must be included in your lease for you to be eligible for vehicle ownership in Bermuda (one vehicle per household). This cannot be added retrospectively.",
    value: "Required before signing · Free", mode: "in-person" as const, url: null, urgent: false,
  },
  {
    id: "arrival-card",
    name: "Step 5 — Bermuda Arrival Card (every re-entry)",
    desc: "Complete the free digital Bermuda Arrival Card online before every flight back to Bermuda. Takes less than 2 minutes. Bookmark bermudaarrivalcard.com on your phone now.",
    value: "Free · Required each re-entry", mode: "online" as const, url: "https://www.bermudaarrivalcard.com", urgent: false,
  },
]

const PROMPTS = [
  {
    value: "arrived",
    title: "I just arrived on a Standard Work Permit",
    sub: "Map my mandatory onboarding steps",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accentD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h5"/>
      </svg>
    ),
  },
  {
    value: "prc",
    title: "Tell me about the Permanent Resident's Certificate",
    sub: "Eligibility after 20 years of residence",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accentD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/>
      </svg>
    ),
  },
  {
    value: "business",
    title: "How do I register a business in Bermuda?",
    sub: "Licences and local-partner rules",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accentD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    ),
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentMark() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 9, backgroundColor: C.accent, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--ca-font-display)", fontSize: 11, fontWeight: 700, flexShrink: 0,
    }}>
      CA
    </div>
  )
}

function AgentLabel() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
      <span style={{ fontSize: "12.5px", fontWeight: 600, color: C.ink }}>Citizen Agent</span>
    </div>
  )
}

function AgentMessage({ content }: { content: string }) {
  return (
    <div className="ca-fade" style={{ display: "flex", gap: 13 }}>
      <AgentMark />
      <div style={{ flex: 1, minWidth: 0 }}>
        <AgentLabel />
        <p style={{ fontSize: 15, lineHeight: 1.7, color: C.body, margin: 0 }}>
          {content.split(/\*\*(.*?)\*\*/g).map((part, i) =>
            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
          )}
        </p>
      </div>
    </div>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="ca-fade" style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{
        maxWidth: "78%", backgroundColor: C.sandBg, color: C.ink,
        padding: "11px 16px", borderRadius: 16, borderTopRightRadius: 5,
        fontSize: "14.5px", lineHeight: 1.55, fontWeight: 500,
      }}>
        {content}
      </div>
    </div>
  )
}

function ActivityCard({ activities, isComplete }: { activities: Activity[]; isComplete: boolean }) {
  const doneCount = activities.filter(a => a.status === "done").length
  const isWarn    = (a: Activity) => a.label.includes("⚠") || a.label.toUpperCase().includes("DEPENDENCY")
  return (
    <div className="ca-fade" style={{ display: "flex", gap: 13 }}>
      <AgentMark />
      <div style={{ flex: 1, minWidth: 0 }}>
        <AgentLabel />
        <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(30,53,80,.05)" }}>
          {/* Top progress bar */}
          <div style={{ height: 3, backgroundColor: isComplete ? C.ok : C.hair }} />
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: C.raised, borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
              {isComplete && (
                <div style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: C.ok, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
                </div>
              )}
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                {isComplete ? `All ${activities.length} checks complete` : "Running checks…"}
              </span>
            </div>
            <span style={{ fontSize: 11, color: C.faint }}>{doneCount}/{activities.length}</span>
          </div>
          {/* Rows */}
          {activities.map(a => {
            const warn = isWarn(a)
            return (
              <div key={a.id} style={{ padding: "11px 16px", borderBottom: `1px solid ${C.hair}` }}>
                <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, marginTop: 1 }}>
                    {a.status === "done" && !warn && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.ok} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
                    )}
                    {a.status === "done" && warn && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.alert} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.9 2.4 18a1.8 1.8 0 0 0 1.6 2.7h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.9 1.9 0 0 0-3.4 0z"/></svg>
                    )}
                    {a.status === "running" && (
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.info}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                    )}
                    {a.status === "waiting" && (
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.border2}` }} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: warn ? C.alertT : C.body, fontWeight: warn ? 600 : 400 }}>{a.label}</div>
                    {a.detail && (
                      <code style={{
                        fontFamily: "var(--ca-font-mono)", fontSize: "10.5px",
                        color: warn ? C.alertT : C.muted,
                        backgroundColor: warn ? C.alertBg : C.raised,
                        border: `1px solid ${warn ? C.alertBd : C.line}`,
                        borderRadius: 7, padding: "6px 9px", marginTop: 6,
                        lineHeight: 1.5, display: "block",
                      }}>
                        {a.detail}
                      </code>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DependencyCard() {
  return (
    <div style={{ backgroundColor: C.alertBg, border: `1px solid ${C.alertBd}`, borderRadius: 11, padding: "10px 14px", marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 13, flexShrink: 0 }}>⚠️</span>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.alertT, margin: "0 0 2px" }}>Dependency found</p>
          <p style={{ fontSize: 12, color: C.alertT, margin: 0, lineHeight: 1.5 }}>
            Work Permit Card (Step 1) must be collected before Social Insurance can be registered
          </p>
        </div>
      </div>
    </div>
  )
}

function StepCard({ step }: { step: typeof STEPS[0] }) {
  const borderColor = step.urgent ? C.alert : step.mode === "online" ? C.ok : C.sky
  return (
    <div style={{
      backgroundColor: C.card,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 13, padding: "15px 17px",
      boxShadow: "0 1px 2px rgba(30,53,80,.05)",
    }}>
      <div className="ca-step-card-header" style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{step.name}</span>
          {step.urgent && (
            <span style={{ fontSize: 10, fontWeight: 700, color: C.alertT, backgroundColor: C.alertBg, border: `1px solid ${C.alertBd}`, padding: "2px 8px", borderRadius: 8 }}>
              Time-sensitive
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, backgroundColor: C.chipBg, padding: "3px 10px", borderRadius: 8, flexShrink: 0, whiteSpace: "nowrap" as const }}>
          {step.value}
        </span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: C.muted, margin: "8px 0 0" }}>{step.desc}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 7,
          ...(step.mode === "online"
            ? { color: C.info, backgroundColor: C.infoBg, border: `1px solid ${C.infoBd}` }
            : { color: C.muted, backgroundColor: C.chipBg }),
        }}>
          {step.mode === "online" ? (
            <><span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.ok, display: "inline-block" }} />Online</>
          ) : (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>In-person</>
          )}
        </span>
        {step.url && (
          <a href={step.url} target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "6px 12px", fontSize: 12, fontWeight: 700,
            backgroundColor: C.accent, color: "#fff", borderRadius: 9,
            textDecoration: "none",
          }}>
            Open registration
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>
          </a>
        )}
      </div>
    </div>
  )
}

function SuggestionChips({ chips, onAction }: { chips: { label: string; value: string; primary?: boolean }[]; onAction: (v: string) => void }) {
  return (
    <div className="ca-fade ca-chips-inner" style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, paddingLeft: 41 }}>
      {chips.map(chip => (
        <button
          key={chip.value}
          onClick={() => onAction(chip.value)}
          className="ca-suggestion-chip"
          style={{
            padding: "7px 14px", fontSize: "12.5px", fontWeight: 500,
            borderRadius: 99, cursor: "pointer", fontFamily: "var(--ca-font-body)",
            border: "none",
            backgroundColor: chip.primary ? C.accentSoft : C.chipBg,
            color: chip.primary ? C.accentD : C.body,
            transition: "background-color .15s, color .15s",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.backgroundColor = chip.primary ? "#ECCFCA" : "#EAE4D8"
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.backgroundColor = chip.primary ? C.accentSoft : C.chipBg
          }}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NavigationAgent() {
  const router = useRouter()
  const [conversationStarted, setConversationStarted] = useState(false)
  const [messages,            setMessages]            = useState<Message[]>([])
  const [isTyping,            setIsTyping]            = useState(false)
  const [waitingForInput,     setWaitingForInput]     = useState<string | null>(null)
  const [currentChips,        setCurrentChips]        = useState<{ label: string; value: string; primary?: boolean }[]>([])
  const bottomRef          = useRef<HTMLDivElement>(null)
  const gateRef            = useRef<string | null>(null)
  const scenarioStartedRef = useRef(false)

  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const addMsg      = (msg: Message) => setMessages(prev => [...prev, msg])
  const updateAct   = (id: string, acts: Activity[]) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, activities: acts } : m))
  const markComplete = (id: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m))
  const withTyping  = async (ms: number) => { setIsTyping(true); await delay(ms); setIsTyping(false) }
  const setGate     = (gate: string, chips: typeof currentChips = []) => {
    gateRef.current = gate; setWaitingForInput(gate); setCurrentChips(chips)
  }
  const clearGate   = () => { gateRef.current = null; setWaitingForInput(null); setCurrentChips([]) }
  const addText     = (text: string) => addMsg({ id: uid(), type: "assistant", content: text })

  // ── Scenarios ──────────────────────────────────────────────────────────────

  async function runArrival() {
    await delay(300)
    const actId = uid("act")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "a1", label: "Checking Standard Work Permit requirements…",       status: "running" },
        { id: "a2", label: "Verifying Department of Immigration requirements…",  status: "waiting" },
        { id: "a3", label: "Checking registration deadlines and dependencies…",  status: "waiting" },
      ],
    })
    await delay(1800)
    updateAct(actId, [
      { id: "a1", label: "Standard Work Permit mandatory steps identified ✓", status: "done", detail: "5 steps · 2 urgent this week · Work Permit Card must come first" },
      { id: "a2", label: "Immigration requirements verified ✓",               status: "done", detail: "Dept. of Immigration · 30 Parliament St, Hamilton · counter closes 4:00pm" },
      { id: "a3", label: "DEPENDENCY FOUND ⚠️",                               status: "done", detail: "Work Permit Card (Step 1) must be collected before Social Insurance can be registered" },
    ])
    markComplete(actId)
    await delay(600)
    await withTyping(700)
    addText("**5 mandatory steps**, in the right order. Two are urgent this week:")
    addMsg({ id: uid("dep"), type: "dep-card" } as Message)
    for (const s of STEPS) { await delay(160); addMsg({ id: uid("s"), type: "step-card", step: s } as Message) }
    await delay(400)
    await withTyping(400)
    addText("Step 1 first, Step 2 straight after — that's the only sequence that works.")
    await delay(350)
    await withTyping(400)
    addText("⚠️ Three things most arrivals miss:\n- No role changes for **12 months**\n- No employer changes for **2 years** without a new permit\n- Permit is void if you leave your job\n\nAlso: after **20 years** of residency you can apply for a PRC under Section 31ZA.")
    setGate("after-arrival", [
      { label: "What documents do I need for Social Insurance?", value: "social",    primary: true },
      { label: "Tell me more about the PRC",                     value: "prc"                     },
      { label: "How do I register a business in Bermuda?",       value: "business"                },
      { label: "Build my action plan →",                         value: "open-plan"               },
    ])
  }

  async function runSocial() {
    await withTyping(700)
    addText("**Documents needed:**\n- Passport (original)\n- Work Permit Card (Step 1 must be done first)\n- Employer's Social Insurance registration number (ask HR day one)")
    await delay(350)
    await withTyping(400)
    addText("Your employer is legally required under the Contributory Pensions Act to register and contribute from **week one**. Confirm with HR in writing.")
    setGate("after-social", [
      { label: "Tell me more about the PRC", value: "prc",       primary: true },
      { label: "Build my action plan →",     value: "open-plan"               },
      { label: "Back to all 5 steps",        value: "arrived"                 },
    ])
  }

  async function runPRC() {
    await withTyping(800)
    addText("Under **Section 31ZA**, after **20 years of ordinary residence** you can apply for a Permanent Resident's Certificate. That gives you the right to live and work without a permit, buy property, and significantly stronger deportation protection.")
    await delay(350)
    await withTyping(350)
    addText("Critical: you must prove all 20 years of continuous residence when you apply. Start a folder now.")
    setGate("after-prc", [
      { label: "What documents do I need for Social Insurance?", value: "social",    primary: true },
      { label: "Build my action plan →",                         value: "open-plan"               },
      { label: "Back to all 5 steps",                            value: "arrived"                 },
    ])
  }

  async function runBusiness() {
    await withTyping(700)
    addText("Work permit holders typically need a separate business licence and, in many sectors, a Bermudian partner with a controlling interest. Specifics depend on business type.")
    await delay(350)
    await withTyping(350)
    addText("Start at **gov.bm** or call Immigration directly at **(441) 295-5151** for permit-holder specifics. Want to go back to your work permit onboarding?")
    setGate("after-business", [
      { label: "Yes — show me my onboarding steps", value: "arrived",   primary: true },
      { label: "Build my action plan →",             value: "open-plan"               },
    ])
  }

  // ── Dispatcher ─────────────────────────────────────────────────────────────

  async function handleAction(value: string) {
    clearGate()
    const labels: Record<string, string> = {
      arrived:   "I just arrived on a Standard Work Permit — what do I need to do?",
      prc:       "Tell me more about the PRC",
      business:  "How do I register a business in Bermuda?",
      social:    "What documents do I need for Social Insurance?",
      "open-plan": "Build my action plan →",
    }
    if (labels[value]) addMsg({ id: uid("u"), type: "user", content: labels[value] })

    if (value === "arrived")   { await runArrival();  return }
    if (value === "prc")       { await runPRC();      return }
    if (value === "business")  { await runBusiness(); return }
    if (value === "social")    { await runSocial();   return }
    if (value === "open-plan") {
      await withTyping(300)
      addText("Opening your action plan now…")
      await delay(300); router.push("/bermuda/plan"); return
    }
    await withTyping(600)
    addText("This demo covers the work permit onboarding flow. Want me to show you your arrival checklist?")
    setGate("fallback", [{ label: "Yes — show me my onboarding steps", value: "arrived", primary: true }])
  }

  async function handlePromptSelect(value: string) {
    if (scenarioStartedRef.current) return
    scenarioStartedRef.current = true
    setConversationStarted(true)
    await handleAction(value)
  }

  // ── Render: Welcome state ──────────────────────────────────────────────────

  if (!conversationStarted) {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

    function handleFreeText(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault()
      const val = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim()
      if (!val || scenarioStartedRef.current) return
      scenarioStartedRef.current = true
      setConversationStarted(true)
      addMsg({ id: uid("u"), type: "user", content: val })
      // fall through to generic handler
      ;(async () => {
        await withTyping(700)
        addText("This demo covers the work permit onboarding flow. Want me to show you your arrival checklist?")
        setGate("fallback", [{ label: "Yes — show me my onboarding steps", value: "arrived", primary: true }])
      })()
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.canvas }}>

        {/* Centered content */}
        <div className="ca-welcome-content" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 40px 24px" }}>
          <h2 className="ca-fade ca-welcome-heading" style={{ fontFamily: "var(--ca-font-display)", fontWeight: 600, fontSize: 31, color: C.ink, margin: 0, letterSpacing: "-0.025em" }}>
            {greeting}, Marcus
          </h2>
          <p className="ca-fade ca-welcome-tagline" style={{ fontSize: 15, color: C.muted, margin: "10px 0 0", textAlign: "center", maxWidth: 430, lineHeight: 1.6 }}>
            I can help you navigate Bermuda government services — permits, registrations, deadlines, and what to do in the right order.
          </p>

          {/* Prompt cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28, width: "100%", maxWidth: 600 }} className="ca-fade">
            {PROMPTS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePromptSelect(p.value)}
                className="ca-prompt-card"
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                  cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "border-color .15s, box-shadow .15s",
                  fontFamily: "var(--ca-font-body)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.accent; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px -6px rgba(176,82,74,.22)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.boxShadow = "none" }}
              >
                <div className="ca-prompt-card-icon" style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.accentSoft, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ca-prompt-card-title" style={{ fontSize: "13.5px", fontWeight: 600, color: C.ink }}>{p.title}</div>
                  <div className="ca-prompt-card-subtitle" style={{ fontSize: 12, color: C.faint, marginTop: 1 }}>{p.sub}</div>
                </div>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
              </button>
            ))}
          </div>
        </div>

        {/* Composer — pinned to bottom */}
        <div style={{ padding: "0 24px 22px", flexShrink: 0 }}>
          <form onSubmit={handleFreeText} style={{ maxWidth: 740, margin: "0 auto" }} className="ca-fade">
            <div className="ca-composer-input-wrap" style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `1px solid ${C.border2}`, borderRadius: 18, padding: "13px 14px 13px 20px", boxShadow: "0 1px 4px rgba(30,53,80,.08)" }}>
              <input
                name="q"
                autoComplete="off"
                style={{ flex: 1, fontSize: 15, color: C.ink, fontFamily: "var(--ca-font-body)", background: "none", border: "none", outline: "none" }}
                placeholder="Ask about Bermuda government services…"
              />
              <button type="submit" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accent, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <ArrowUp size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Render: Conversation state ─────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.canvas }}>

      {/* Context pills */}
      <div className="ca-context-pills-outer" style={{ padding: "12px 24px 0", flexShrink: 0 }}>
        <div className="ca-context-pills-inner" style={{ maxWidth: 740, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {[
            { label: "Bermuda" },
            { label: "Standard Work Permit" },
            { label: "Marcus Tavares" },
          ].map(pill => (
            <span key={pill.label} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 500, color: C.body,
              backgroundColor: C.chipBg, padding: "5px 12px", borderRadius: 9,
            }}>
              {pill.label}
            </span>
          ))}
        </div>
      </div>

      {/* Message feed */}
      <div className="ca-message-feed" style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
        <div className="ca-message-feed-inner" style={{ maxWidth: 740, margin: "0 auto", padding: "26px 0 24px", display: "flex", flexDirection: "column", gap: 26 }}>
          {messages.map(msg => (
            <Fragment key={msg.id}>
              {msg.type === "user" ? (
                <UserMessage content={msg.content!} />
              ) : msg.type === "activity" ? (
                <ActivityCard activities={msg.activities!} isComplete={!!msg.isComplete} />
              ) : msg.type === "dep-card" ? (
                <DependencyCard />
              ) : msg.type === "step-card" ? (
                <StepCard step={msg.step!} />
              ) : msg.type === "assistant" ? (
                <AgentMessage content={msg.content!} />
              ) : null}
            </Fragment>
          ))}

          {isTyping && (
            <div className="ca-fade" style={{ display: "flex", gap: 13 }}>
              <AgentMark />
              <div style={{ flex: 1 }}>
                <AgentLabel />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestion chips */}
      {waitingForInput && currentChips.length > 0 && !isTyping && (
        <div className="ca-chips-wrapper" style={{ backgroundColor: C.card, borderTop: `1px solid ${C.line}`, padding: "12px 24px", flexShrink: 0 }}>
          <div style={{ maxWidth: 740, margin: "0 auto" }}>
            <SuggestionChips chips={currentChips} onAction={handleAction} />
          </div>
        </div>
      )}

      {/* Composer / working bar */}
      <div style={{ padding: "0 24px 22px", flexShrink: 0 }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          {isTyping ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.raised, border: `1px solid ${C.line}`, borderRadius: 16, padding: "11px 12px 11px 18px" }}>
              <span style={{ flex: 1, fontSize: 14, color: C.faint }}>Citizen Agent is handling this step…</span>
              <div className="ca-dot-anim"><span /><span /><span /></div>
            </div>
          ) : (
            <div className="ca-composer-input-wrap" style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `1px solid ${C.border2}`, borderRadius: 18, padding: "11px 12px 11px 18px", boxShadow: "0 1px 2px rgba(30,53,80,.05)" }}>
              <input
                style={{ flex: 1, fontSize: 14, color: C.faint, fontFamily: "var(--ca-font-body)", background: "none", border: "none", outline: "none" }}
                placeholder="Ask about Bermuda government services…"
                readOnly
              />
              <button style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.accent, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <ArrowUp size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
