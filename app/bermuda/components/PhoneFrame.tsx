"use client"

import { useState, useEffect } from "react"

interface Props {
  src: string
  onExit: () => void
}

// ── Status bar icons ─────────────────────────────────────────────────────────

function SignalIcon() {
  return (
    <svg width="17" height="12" viewBox="0 0 17 12" fill="white">
      <rect x="0"    y="8"   width="3" height="4"  rx="0.5" />
      <rect x="4.5"  y="5.5" width="3" height="6.5" rx="0.5" />
      <rect x="9"    y="3"   width="3" height="9"  rx="0.5" />
      <rect x="13.5" y="0"   width="3" height="12" rx="0.5" opacity="0.35" />
    </svg>
  )
}

function WifiIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <circle cx="8" cy="11" r="1.5" fill="white" />
      <path d="M4.8 8C5.8 7 6.8 6.5 8 6.5s2.2.5 3.2 1.5"
        stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.2 5.5C3.8 3.9 5.8 3 8 3s4.2.9 5.8 2.5"
        stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
    </svg>
  )
}

function BatteryIcon() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
      <div style={{
        width: 25, height: 12,
        border: "1.5px solid rgba(255,255,255,0.9)",
        borderRadius: 3.5,
        padding: "1.5px 2px",
        boxSizing: "border-box",
      }}>
        <div style={{
          width: "75%", height: "100%",
          backgroundColor: "white",
          borderRadius: 1.5,
        }} />
      </div>
      <div style={{
        width: 2, height: 5,
        backgroundColor: "rgba(255,255,255,0.55)",
        borderRadius: "0 1px 1px 0",
      }} />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PhoneFrame({ src, onExit }: Props) {
  const [time, setTime] = useState("")

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    setTime(fmt())
    const t = setInterval(() => setTime(fmt()), 30_000)
    return () => clearInterval(t)
  }, [])

  // ── Phone dimensions (scale to viewport height) ──────────────────────────
  // Outer frame: 418 × 880  |  screen: 390 × 832 (14px bezels L/R, 33px top, 15px bottom)
  // clamp keeps it legible on small monitors while capping at true device size

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      {/* ── Exit button ─────────────────────────────────────── */}
      <button
        onClick={onExit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 20px",
          borderRadius: 99,
          backgroundColor: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "rgba(255,255,255,0.85)",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "var(--ca-font-body, system-ui, sans-serif)",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          letterSpacing: "0.01em",
          transition: "background-color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.16)")}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.10)")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Exit mobile view
      </button>

      {/* ── Phone bezel ─────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          height: "clamp(620px, 92vh, 880px)",
          aspectRatio: "418 / 880",
          backgroundColor: "#1A1A1A",
          borderRadius: 52,
          boxShadow: [
            "0 0 0 1px #3A3A3A",          // inner edge highlight
            "0 0 0 3px #111",              // outer ring
            "0 32px 80px rgba(0,0,0,0.75)",// floor shadow
            "0 4px 16px rgba(0,0,0,0.5)",  // base shadow
            "inset 0 0 0 1px #3A3A3A",     // inner ring
          ].join(", "),
          flexShrink: 0,
        }}
      >
        {/* ── Left side buttons (volume) ─────────────── */}
        <div style={{ position: "absolute", left: -3, top: "17%", width: 3, height: "4%",
          backgroundColor: "#2E2E2E", borderRadius: "2px 0 0 2px",
          boxShadow: "-1px 0 0 #111" }} />
        <div style={{ position: "absolute", left: -3, top: "23%", width: 3, height: "7%",
          backgroundColor: "#2E2E2E", borderRadius: "2px 0 0 2px",
          boxShadow: "-1px 0 0 #111" }} />
        <div style={{ position: "absolute", left: -3, top: "32%", width: 3, height: "7%",
          backgroundColor: "#2E2E2E", borderRadius: "2px 0 0 2px",
          boxShadow: "-1px 0 0 #111" }} />

        {/* ── Right side button (power) ──────────────── */}
        <div style={{ position: "absolute", right: -3, top: "26%", width: 3, height: "10%",
          backgroundColor: "#2E2E2E", borderRadius: "0 2px 2px 0",
          boxShadow: "1px 0 0 #111" }} />

        {/* ── Screen area ────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            top: "3.7%",    // ~33px top bezel
            bottom: "1.7%", // ~15px bottom bezel
            left: "3.3%",   // ~14px side bezel
            right: "3.3%",
            backgroundColor: "#000",
            borderRadius: 44,
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          {/* ── Dynamic Island ───────────────────────── */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              width: "26%",    // smaller — less obtrusive
              height: 26,
              backgroundColor: "#000",
              borderRadius: 16,
              zIndex: 20,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
            }}
          />

          {/* ── Status bar ───────────────────────────── */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 48,
              zIndex: 15,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              paddingBottom: 7,
              paddingLeft: 20,
              paddingRight: 16,
              pointerEvents: "none",
            }}
          >
            {/* Time */}
            <span style={{
              color: "white",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
              letterSpacing: "-0.02em",
            }}>
              {time || "9:41"}
            </span>

            {/* Right icons */}
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <SignalIcon />
              <WifiIcon />
              <BatteryIcon />
            </div>
          </div>

          {/* ── The app (iframe) ─────────────────────── */}
          <iframe
            src={src}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
            title="Citizen Agent — Mobile Preview"
          />
        </div>
      </div>

      {/* ── Bottom label ────────────────────────────────────── */}
      <p style={{
        fontSize: 12,
        color: "rgba(255,255,255,0.3)",
        fontFamily: "var(--ca-font-body, system-ui, sans-serif)",
        letterSpacing: "0.03em",
      }}>
        Mobile preview · Citizen Agent
      </p>
    </div>
  )
}
