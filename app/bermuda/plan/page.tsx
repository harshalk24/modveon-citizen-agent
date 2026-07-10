"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import BermudaLayout from "../BermudaLayout"

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  canvas:  "#F8F6F1",
  card:    "#FFFFFF",
  raised:  "#F3EEE5",
  border:  "#EAE5DB",
  hair:    "#F0ECE2",
  line:    "#ECE6DC",
  ink:     "#1E3550",
  body:    "#3A4656",
  muted:   "#6A7280",
  faint:   "#9AA0A8",
  accent:  "#B0524A",
  ok:      "#3C7D5A",
  okT:     "#326B4D",
  okBg:    "#E7F1EB",
  okBd:    "#D2E5D8",
  alert:   "#B58233",
  alertT:  "#8E6627",
  alertBg: "#F6EFD9",
  alertBd: "#E7DCB8",
  info:    "#35618C",
  infoBg:  "#E7EDF4",
  infoBd:  "#D0DCEB",
  sky:     "#7FA8C9",
  chipBg:  "#F1EDE4",
}

interface Step {
  id: string; title: string; location: string; mode: "online" | "in-person"
  cost: string; time: string; link?: string; documents?: string[]; note: string; urgent?: boolean
}
interface Phase {
  phase: number; label: string; timing: string; urgency: "urgent" | "normal" | "ongoing"; steps: Step[]
}

const PLAN: Phase[] = [
  {
    phase: 1, label: "Collect your Work Permit Card", timing: "Week 1", urgency: "urgent",
    steps: [{
      id: "work-permit-card",
      title: "Collect Work Permit Card from Immigration",
      location: "Dept. of Immigration — Gov. Administration Building, 30 Parliament St, Hamilton",
      mode: "in-person", cost: "USD 160", time: "Mon–Fri 9:00am–5:00pm · Counter closes 4:00pm",
      documents: ["Original work permit approval letter (photocopies rejected)", "Valid passport"],
      note: "This card is your primary immigration document in Bermuda and is required before completing any of the steps below.",
      urgent: true,
    }],
  },
  {
    phase: 2, label: "Register for Social Insurance", timing: "Week 1 — after Step 1", urgency: "urgent",
    steps: [{
      id: "social-insurance",
      title: "Register for Social Insurance",
      location: "Dept. of Social Insurance — online or in-person",
      mode: "online", cost: "Free", time: "~15 minutes online",
      link: "https://www2.gov.bm/department/social-insurance",
      documents: ["Work Permit Card (required)", "Passport", "Employer's Social Insurance registration number"],
      note: "Your employer must also register and contribute from your first week of employment — this is a legal requirement under the Contributory Pensions Act. Confirm with HR in writing.",
      urgent: true,
    }],
  },
  {
    phase: 3, label: "Health Insurance & Housing", timing: "Within 30 days", urgency: "normal",
    steps: [
      {
        id: "health-insurance",
        title: "Confirm Health Insurance enrolment with employer",
        location: "Your employer · Health Insurance Dept. (if self-enrolling)",
        mode: "online", cost: "Employer-paid (min. 50% of SHB premium)", time: "Ask HR on your first day · enrol by day 30",
        link: "https://www2.gov.bm/department/health-insurance",
        note: "Under the Health Insurance Act 1970, your employer must cover at least 50% of your Standard Health Benefit premium. Ask for written confirmation on day one.",
      },
      {
        id: "assessment-number",
        title: "Get Assessment Number from landlord (before signing lease)",
        location: "Your landlord — ask before signing any tenancy agreement",
        mode: "in-person", cost: "Free", time: "Before signing your lease",
        note: "Your tenancy agreement must include the property's Assessment Number for you to qualify for vehicle ownership in Bermuda. Only one vehicle is permitted per household. This cannot be added after you have signed.",
      },
    ],
  },
  {
    phase: 4, label: "Bermuda Arrival Card — every re-entry", timing: "Ongoing", urgency: "ongoing",
    steps: [{
      id: "arrival-card",
      title: "Complete Bermuda Arrival Card before every re-entry",
      location: "Online — before boarding (bermudaarrivalcard.com)",
      mode: "online", cost: "Free", time: "Under 2 minutes · required before every flight to Bermuda",
      link: "https://www.bermudaarrivalcard.com/",
      note: "Bookmark this site on your phone. The Government of Bermuda warns against third-party sites that charge a fee — this service is free. Forgetting it can cause delays at the airport.",
    }],
  },
]

const URGENCY: Record<Phase["urgency"], { borderColor: string; timingColor: string; timingBg: string; timingBd: string; label: string }> = {
  urgent:  { borderColor: C.alert,  timingColor: C.alertT, timingBg: C.alertBg, timingBd: C.alertBd, label: "This week" },
  normal:  { borderColor: C.sky,    timingColor: C.info,   timingBg: C.infoBg,  timingBd: C.infoBd,  label: "Within 30 days" },
  ongoing: { borderColor: C.sky,    timingColor: C.info,   timingBg: C.infoBg,  timingBd: C.infoBd,  label: "Every trip" },
}

export default function BermudaPlanPage() {
  const allSteps  = PLAN.flatMap(p => p.steps)
  const [done,     setDone]     = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1, 2]))
  const [inFrame,     setInFrame]     = useState(false)
  const [browserUrl,  setBrowserUrl]  = useState<string | null>(null)

  useEffect(() => { setInFrame(window.self !== window.top) }, [])

  const doneCount = allSteps.filter(s => done.has(s.id)).length
  const progress  = Math.round((doneCount / allSteps.length) * 100)

  const toggleDone  = (id: string) =>
    setDone(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const togglePhase = (p: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n })

  return (
    <BermudaLayout
      activeTab="navigation"
      layerLabel="Layer 1 · Navigate"
      subtitle="Bermuda · Standard Work Permit · Passport ••••4521"
    >
      {/* ── In-app browser overlay (phone frame only) ─────────────────────── */}
      {browserUrl && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
          {/* Address bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", backgroundColor: C.ink, flexShrink: 0 }}>
            <button
              onClick={() => setBrowserUrl(null)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--ca-font-body)", flexShrink: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
              Back
            </button>
            <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 9px", fontSize: 10, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {browserUrl}
            </div>
          </div>
          {/* Embedded page */}
          <iframe
            src={browserUrl}
            style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
            title="Government registration"
          />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

        {/* Plan header */}
        <div className="ca-plan-header" style={{ padding: "24px 36px 20px", borderBottom: `1px solid ${C.line}`, flexShrink: 0, backgroundColor: C.card }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <Link className="ca-plan-back-link" href="/bermuda" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.faint, textDecoration: "none", marginBottom: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
              Back to chat
            </Link>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
              <div>
                <h2 className="ca-plan-heading" style={{ fontFamily: "var(--ca-font-display)", fontSize: 24, fontWeight: 600, color: C.ink, margin: 0, letterSpacing: "-0.025em" }}>
                  Your arrival plan
                </h2>
                <p className="ca-plan-subtitle" style={{ fontSize: 13, color: C.faint, margin: "5px 0 0" }}>Marcus Tavares · Standard Work Permit · Bermuda</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.okT, backgroundColor: C.okBg, border: `1px solid ${C.okBd}`, padding: "5px 11px", borderRadius: 9, flexShrink: 0, whiteSpace: "nowrap" as const }}>
                {doneCount} / {allSteps.length} complete
              </span>
            </div>
            <div className="ca-plan-progress" style={{ height: 6, backgroundColor: C.hair, borderRadius: 99, overflow: "hidden", marginTop: 16 }}>
              <div style={{ height: "100%", backgroundColor: C.ok, borderRadius: 99, width: `${progress}%`, transition: "width .4s ease" }} />
            </div>
          </div>
        </div>

        {/* Phase list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div className="ca-plan-content" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 36px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
            {PLAN.map(phase => {
              const phaseDone  = phase.steps.every(s => done.has(s.id))
              const phaseOpen  = expanded.has(phase.phase)
              const urg        = URGENCY[phase.urgency]
              const borderLeft = phaseDone ? `3px solid ${C.ok}` : `3px solid ${urg.borderColor}`

              return (
                <div key={phase.phase} style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderLeft, borderRadius: 13, overflow: "hidden", boxShadow: "0 1px 2px rgba(30,53,80,.05)" }}>
                  {/* Phase header */}
                  <button
                    className="ca-plan-phase-header"
                    onClick={() => togglePhase(phase.phase)}
                    style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 18px", backgroundColor: C.raised, cursor: "pointer", border: "none", borderBottom: phaseOpen ? `1px solid ${C.line}` : "none", fontFamily: "var(--ca-font-body)", textAlign: "left" as const }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Badge */}
                      {phaseDone ? (
                        <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: C.ok, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
                        </div>
                      ) : (
                        <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: urg.timingBg, color: urg.timingColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, border: `1px solid ${urg.timingBd}` }}>
                          {phase.phase}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: "13.5px", fontWeight: 600, color: C.ink }}>{phase.label}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                          {phaseDone ? (
                            <span style={{ fontSize: 10, fontWeight: 600, color: C.okT, backgroundColor: C.okBg, border: `1px solid ${C.okBd}`, padding: "2px 8px", borderRadius: 8 }}>
                              Phase {phase.phase} · completed
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 600, color: urg.timingColor, backgroundColor: urg.timingBg, border: `1px solid ${urg.timingBd}`, padding: "2px 8px", borderRadius: 8 }}>
                              {urg.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {phaseOpen ? <path d="M18 15l-6-6-6 6"/> : <path d="M6 9l6 6 6-6"/>}
                    </svg>
                  </button>

                  {/* Phase body */}
                  {phaseOpen && (
                    <div>
                      {phase.steps.map(step => {
                        const isDone = done.has(step.id)
                        return (
                          <div key={step.id} className="ca-plan-step-body" style={{ padding: "18px 20px", opacity: isDone ? 0.5 : 1 }}>

                            {/* Title row */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 11 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                                {step.urgent && !isDone && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: C.alertT, backgroundColor: C.alertBg, border: `1px solid ${C.alertBd}`, padding: "2px 8px", borderRadius: 8 }}>
                                    Urgent
                                  </span>
                                )}
                                <span className="ca-plan-step-title" style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{step.title}</span>
                              </div>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 7, flexShrink: 0,
                                ...(step.mode === "online"
                                  ? { color: C.info, backgroundColor: C.infoBg, border: `1px solid ${C.infoBd}` }
                                  : { color: C.muted, backgroundColor: C.chipBg }),
                              }}>
                                {step.mode === "online" ? (
                                  <><span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.ok, display: "inline-block" }} />Online</>
                                ) : (
                                  <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>In-person</>
                                )}
                              </span>
                            </div>

                            {/* Location */}
                            <div className="ca-plan-step-location" style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: "12.5px", color: C.muted, marginBottom: 8 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>
                              </svg>
                              {step.location}
                            </div>

                            {/* Cost + time */}
                            <div className="ca-plan-step-meta" style={{ display: "flex", gap: 20, fontSize: "12.5px", color: C.muted, marginBottom: 14, paddingLeft: 21 }}>
                              <span>Cost · <strong style={{ color: C.ink, fontWeight: 600 }}>{step.cost}</strong></span>
                              <span>Time · <strong style={{ color: C.ink, fontWeight: 600 }}>{step.time}</strong></span>
                            </div>

                            {/* Documents */}
                            {step.documents && (
                              <div className="ca-plan-step-docs" style={{ marginBottom: 12, backgroundColor: C.infoBg, border: `1px solid ${C.infoBd}`, borderRadius: 11, padding: "12px 14px" }}>
                                <div className="ca-plan-step-docs-title" style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: C.info, marginBottom: 7 }}>
                                  Documents needed
                                </div>
                                {step.documents.map((doc, i) => (
                                  <div className="ca-plan-step-docs-item" key={i} style={{ fontSize: "12.5px", color: C.body, display: "flex", gap: 8, marginBottom: i < step.documents!.length - 1 ? 5 : 0 }}>
                                    <span style={{ color: C.info, flexShrink: 0 }}>·</span>
                                    {doc}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Note */}
                            <p className="ca-plan-step-note" style={{ fontSize: "12.5px", color: C.muted, backgroundColor: C.raised, border: `1px solid ${C.line}`, borderRadius: 11, padding: "11px 14px", margin: "0 0 16px", lineHeight: 1.6 }}>
                              {step.note}
                            </p>

                            {/* Actions */}
                            <div className="ca-plan-step-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              {step.link && step.mode === "online" ? (
                                <button
                                  onClick={() => inFrame ? setBrowserUrl(step.link!) : window.open(step.link, "_blank")}
                                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 16px", fontSize: 13, fontWeight: 600, backgroundColor: C.accent, color: "#fff", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--ca-font-body)" }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>
                                  Apply now
                                </button>
                              ) : (
                                <Link href="/bermuda" style={{ fontSize: 12, color: C.faint, textDecoration: "none", fontWeight: 500 }}>
                                  Ask agent
                                </Link>
                              )}
                              <button
                                onClick={() => toggleDone(step.id)}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "9px 16px", fontSize: 13, fontWeight: 600,
                                  borderRadius: 9, cursor: "pointer",
                                  fontFamily: "var(--ca-font-body)",
                                  ...(isDone
                                    ? { backgroundColor: C.okBg, color: C.okT, border: `1px solid ${C.okBd}` }
                                    : { backgroundColor: C.card, color: C.body, border: `1px solid ${C.border}` }),
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
                                {isDone ? "Done ✓" : "Mark as done"}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            <p style={{ textAlign: "center", fontSize: 11, color: C.faint, margin: "14px 0 0" }}>
              🇧🇲 Government of Bermuda · Information correct as of June 2026 · Always verify at gov.bm
            </p>
          </div>
        </div>
      </div>
    </BermudaLayout>
  )
}
