"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import "./bermuda.css"
import PhoneFrame from "./components/PhoneFrame"

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  canvas:    "#F8F6F1",
  card:      "#FFFFFF",
  line:      "#ECE6DC",
  sidebar:   "#1E3550",
  sbBorder:  "#2C435E",
  sbActive:  "#28425E",
  sbText:    "#EDEFF2",
  sbMuted:   "#A9B4C4",
  sbFaint:   "#7C8B9E",
  ink:       "#1E3550",
  muted:     "#6A7280",
  faint:     "#9AA0A8",
  accent:    "#B0524A",
  chipBg:    "#F1EDE4",
  sky:       "#7FA8C9",
  ok:        "#3C7D5A",
  okBg:      "#E7F1EB",
  alertBg:   "#F6EFD9",
  alertT:    "#8E6627",
}

interface Props {
  children:      React.ReactNode
  activeTab:     "navigation" | "proactive"
  layerLabel:    string
  subtitle:      string
  userName?:     string
  userInitials?: string
  userRole?:     string
}

const NAV_ITEMS = [
  {
    label: "Chat", href: "/bermuda",
    icon: (color: string) => (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 21l1.9-5.8A8.5 8.5 0 1 1 21 11.5z"/>
      </svg>
    ),
  },
  {
    label: "Dashboard", href: "/bermuda/dashboard",
    icon: (color: string) => (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    label: "My Plan", href: "/bermuda/plan",
    icon: (color: string) => (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 5.5l1 1 2-2"/><path d="M4 11.5l1 1 2-2"/><path d="M4 17.5l1 1 2-2"/>
      </svg>
    ),
  },
  {
    label: "My Profile", href: "/bermuda/profile",
    icon: (color: string) => (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
      </svg>
    ),
  },
]

const RECENT = [
  { label: "Work permit onboarding", href: "/bermuda",           active: true  },
  { label: "Social Insurance setup",  href: "/bermuda",           active: false },
  { label: "Vehicle renewal query",   href: "/bermuda/proactive", active: false },
]

export default function BermudaLayout({ children, activeTab, layerLabel, subtitle, userName, userInitials, userRole }: Props) {
  const pathname    = usePathname()
  const hour        = new Date().getHours()
  const greeting    = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const displayName = userName ?? "Marcus Tavares"
  const firstName   = displayName.split(" ")[0]
  const initials    = userInitials ?? "MT"
  const role        = userRole ?? "Standard Work Permit"

  // ── Phone frame presentation mode ──────────────────────────────────────────
  const [isPresentation,  setIsPresentation]  = useState(false)
  const [phoneMode,       setPhoneMode]       = useState(false)
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false)

  useEffect(() => {
    setIsPresentation(
      new URLSearchParams(window.location.search).get("presentation") === "1"
    )
  }, [])

  // When phone mode is ON, show the dimmed stage + phone frame (via iframe)
  if (phoneMode && !isPresentation) {
    const iframeSrc = (pathname === "/bermuda/proactive"
      ? "/bermuda/proactive/intro"
      : pathname) + "?presentation=1"
    return (
      <div
        style={{
          position:        "fixed",
          inset:           0,
          zIndex:          60,
          background:      "radial-gradient(ellipse at 50% 40%, #252545 0%, #131320 100%)",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          overflowY:       "auto",
          padding:         "12px 12px",
          fontFamily:      "var(--ca-font-body)",
        }}
      >
        <PhoneFrame src={iframeSrc} onExit={() => setPhoneMode(false)} />
      </div>
    )
  }

  return (
    <div
      className="ca-fixed-root fixed inset-0 z-50 flex overflow-hidden"
      style={{ fontFamily: "var(--ca-font-body)", backgroundColor: C.canvas }}
    >

      {/* ── Mobile sidebar backdrop ──────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 79, backgroundColor: "rgba(0,0,0,0.45)" }}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside
        className={`ca-sidebar flex-shrink-0 flex flex-col${mobileMenuOpen ? " ca-mobile-open" : ""}`}
        style={{
          width: "var(--ca-sidebar-w)",
          backgroundColor: C.sidebar,
          borderRight: `1px solid ${C.sbBorder}`,
          padding: "22px 14px",
        }}
      >
        {/* Logo */}
        <div className="flex items-center" style={{ gap: 11, padding: "2px 6px 0" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            backgroundColor: C.accent, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--ca-font-display)", fontSize: 15, fontWeight: 700, flexShrink: 0,
          }}>
            CA
          </div>
          <div>
            <div style={{ fontSize: "14.5px", fontWeight: 600, color: C.sbText, letterSpacing: "-0.01em" }}>
              Citizen Agent
            </div>
            <div style={{ fontSize: 11, color: C.sbFaint, marginTop: 1 }}>Bermuda · Gov Services</div>
          </div>
        </div>

        {/* New conversation */}
        <button
          className="flex items-center w-full text-left transition-opacity hover:opacity-85"
          style={{
            marginTop: 22, gap: 9, padding: "10px 12px", borderRadius: 11,
            border: `1px solid ${C.sbBorder}`, backgroundColor: C.sbActive,
            color: C.sbText, fontSize: 13, fontWeight: 600,
            fontFamily: "var(--ca-font-body)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New conversation
        </button>

        {/* Nav */}
        <nav className="flex flex-col" style={{ marginTop: 20, gap: 3 }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || (item.href !== "/bermuda" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center transition-colors"
                style={{
                  gap: 11, padding: "9px 12px", borderRadius: 10,
                  backgroundColor: active ? C.sbActive : "transparent",
                  color: active ? "#fff" : C.sbMuted,
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  textDecoration: "none",
                }}
              >
                {item.icon(active ? C.accent : C.sbFaint)}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Recent */}
        <div className="flex flex-col" style={{ marginTop: 18, borderTop: `1px solid ${C.sbBorder}`, paddingTop: 16, gap: 4 }}>
          <div style={{
            fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.06em",
            textTransform: "uppercase", color: C.sbFaint, padding: "0 6px 4px",
          }}>
            Recent
          </div>
          {RECENT.map(item => (
            <Link
              key={item.label}
              href={item.href}
              className="block rounded-[9px] transition-colors hover:bg-[#28425E]"
              style={{
                padding: "7px 12px", fontSize: "12.5px",
                color: item.active ? C.sbText : C.sbMuted,
                backgroundColor: item.active ? C.sbActive : "transparent",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex-1" />

        {/* User tile */}
        <div
          className="flex items-center"
          style={{ gap: 10, padding: 8, borderRadius: 11, border: `1px solid ${C.sbBorder}` }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            backgroundColor: "#0E3D52", color: C.sky,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: C.sbText }}>{displayName}</div>
            <div style={{ fontSize: "10.5px", color: C.sbFaint }}>{role}</div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="ca-topbar flex items-center justify-between flex-shrink-0"
          style={{ padding: "16px 30px", borderBottom: `1px solid ${C.line}`, backgroundColor: C.card }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="ca-hamburger"
              onClick={() => setMobileMenuOpen(v => !v)}
              aria-label="Menu"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                backgroundColor: "transparent", border: "none",
                color: C.faint, cursor: "pointer", padding: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 6h18M3 12h18M3 18h18"/>
              </svg>
            </button>
            <div>
              <div className="ca-topbar-greeting" style={{
                fontFamily: "var(--ca-font-display)", fontSize: 18,
                fontWeight: 600, color: C.ink, letterSpacing: "-0.02em",
              }}>
                <span className="ca-greeting-text">{greeting}, </span>{firstName}
              </div>
              <div className="ca-topbar-subtitle" style={{ fontSize: 12, color: C.faint, marginTop: 1 }}>{subtitle}</div>
            </div>
          </div>

          <div className="ca-topbar-right flex items-center" style={{ gap: 12 }}>
            <span className="ca-layer-pill" style={{
              fontSize: 12, fontWeight: 600, color: C.muted,
              backgroundColor: C.chipBg, padding: "5px 11px", borderRadius: 8,
            }}>
              {layerLabel}
            </span>
            <span className="ca-demo-badge" style={{
              fontSize: 12, fontWeight: 600,
              backgroundColor: "#FEF3C7", color: "#92400E",
              padding: "5px 11px", borderRadius: 8,
            }}>
              Demo Mode
            </span>
          </div>
        </header>

        {/* Content slot */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>

      {/* ── Phone frame toggle (floating, outside app chrome) ──────────────── */}
      {!isPresentation && (
        <button
          className="ca-phone-toggle"
          onClick={() => setPhoneMode(true)}
          title="View as mobile app"
          style={{
            position:        "absolute",
            bottom:          20,
            right:           20,
            zIndex:          55,
            display:         "flex",
            alignItems:      "center",
            gap:             7,
            padding:         "8px 14px 8px 12px",
            borderRadius:    99,
            backgroundColor: C.sidebar,
            border:          `1px solid ${C.sbBorder}`,
            color:           C.sbMuted,
            fontSize:        12,
            fontWeight:      600,
            fontFamily:      "var(--ca-font-body)",
            cursor:          "pointer",
            boxShadow:       "0 4px 14px rgba(0,0,0,0.25)",
            transition:      "opacity 0.15s, transform 0.15s",
            opacity:         0.85,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = "1"
            e.currentTarget.style.transform = "translateY(-1px)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = "0.85"
            e.currentTarget.style.transform = "none"
          }}
        >
          {/* Phone icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="3" />
            <circle cx="12" cy="18" r="0.5" fill="currentColor" />
          </svg>
          Mobile view
        </button>
      )}
    </div>
  )
}
