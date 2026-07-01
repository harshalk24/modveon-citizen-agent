"use client"

import Link from "next/link"
import BermudaLayout from "../BermudaLayout"

const C = {
  canvas:     "#F8F6F1",
  card:       "#FFFFFF",
  border:     "#EAE5DB",
  border2:    "#E0DACE",
  ink:        "#1E3550",
  muted:      "#6A7280",
  faint:      "#9AA0A8",
  accent:     "#B0524A",
  accentSoft: "#F4E4E0",
  alertBg:    "#F6EFD9",
  alertT:     "#8E6627",
  infoBg:     "#E7EDF4",
  info:       "#35618C",
  ok:         "#3C7D5A",
}

const SCENARIOS = [
  {
    icon: "👶",
    title: "Newborn Registration",
    sub: "Registry General · Health insurance enrollment",
    href: "/bermuda/proactive/newborn-registration",
    tag: "3 days old",
    tagBg: C.alertBg, tagT: C.alertT,
  },
  {
    icon: "🚗",
    title: "Vehicle Renewal",
    sub: "Transport Control Department · Licensing & inspections",
    href: "/bermuda/proactive/vehicle",
    tag: "11 days",
    tagBg: C.alertBg, tagT: C.alertT,
  },
  {
    icon: "💰",
    title: "Social Insurance & Pensions",
    sub: "Contributions, forecasts & benefits",
    href: "/bermuda/proactive/social-insurance",
    tag: "Action needed",
    tagBg: "#FAE0DB", tagT: "#BC3A3A",
  },
  {
    icon: "🪪",
    title: "Work Permit Renewal",
    sub: "Immigration · Compliance & PRC tracking",
    href: "/bermuda/proactive/work-permit",
    tag: "58 days",
    tagBg: C.infoBg, tagT: C.info,
  },
  {
    icon: "🏢",
    title: "Business Registration",
    sub: "Economic Development · Company setup & licensing",
    href: "/bermuda/proactive/business-registration",
    tag: "Ready",
    tagBg: C.infoBg, tagT: C.info,
  },
]

export default function BermudaProactivePage() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return (
    <BermudaLayout
      activeTab="proactive"
      layerLabel="Layer 2 · Act"
      subtitle="Bermuda · Verified Citizens · Demo"
      userName="Citizen Agent"
      userInitials="CA"
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.canvas, overflowY: "auto" }}>

        {/* Centered welcome block */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 40px 32px" }}>

          {/* Agent mark + status */}
          <div className="ca-fade" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              backgroundColor: C.accent, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--ca-font-display)", fontSize: 13, fontWeight: 700,
            }}>CA</div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: C.ink }}>Citizen Agent</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.ok, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: C.faint }}>All checks complete · ready to act</span>
              </div>
            </div>
          </div>

          {/* Heading */}
          <h2 className="ca-fade" style={{
            fontFamily: "var(--ca-font-display)", fontWeight: 600, fontSize: 31,
            color: C.ink, margin: 0, letterSpacing: "-0.025em", textAlign: "center",
          }}>
            {greeting}
          </h2>
          <p className="ca-fade" style={{
            fontSize: 15, color: C.muted, margin: "10px 0 0",
            textAlign: "center", maxWidth: 440, lineHeight: 1.65,
          }}>
            Five citizens. Five situations. The agent has already done the background work — choose a scenario to see it act.
          </p>

          {/* Scenario cards */}
          <div className="ca-fade" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28, width: "100%", maxWidth: 600 }}>
            {SCENARIOS.map(s => (
              <Link
                key={s.href}
                href={s.href}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  backgroundColor: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  textDecoration: "none",
                  boxShadow: "0 1px 2px rgba(30,53,80,.05)",
                  transition: "border-color .15s, box-shadow .15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = C.accent
                  ;(e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px -6px rgba(176,82,74,.22)"
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = C.border
                  ;(e.currentTarget as HTMLElement).style.boxShadow = "0 1px 2px rgba(30,53,80,.05)"
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  backgroundColor: C.accentSoft,
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>
                  {s.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 2 }}>
                    <span style={{ fontSize: "13.5px", fontWeight: 600, color: C.ink }}>{s.title}</span>
                    <span style={{
                      fontSize: "10.5px", fontWeight: 600,
                      padding: "2px 7px", borderRadius: 6,
                      backgroundColor: s.tagBg, color: s.tagT,
                    }}>{s.tag}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.faint }}>{s.sub}</div>
                </div>

                {/* Arrow */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M9 6l6 6-6 6"/>
                </svg>
              </Link>
            ))}
          </div>

          <p className="ca-fade" style={{ fontSize: 11, color: C.faint, marginTop: 20, textAlign: "center", lineHeight: 1.6 }}>
            All scenarios are static demos — no real government actions are taken.
          </p>
        </div>
      </div>
    </BermudaLayout>
  )
}
