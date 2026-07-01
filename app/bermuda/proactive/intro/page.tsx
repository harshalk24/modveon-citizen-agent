"use client"

import { useRouter } from "next/navigation"

export default function CitizenAgentIntro() {
  const router = useRouter()

  const FONT = "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, sans-serif"

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 50,
      overflow: "hidden",
      background: "radial-gradient(ellipse 125% 72% at 50% 24%, #2C456A 0%, #1E3550 48%, #15263C 100%)",
      fontFamily: FONT,
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "48px 26px 22px",
      boxSizing: "border-box",
    }}>

      {/* Logo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <img
          src="/modveon-logo-cropped.png"
          alt="Modveon"
          style={{ width: 108, height: "auto", mixBlendMode: "screen", display: "block" }}
        />
        <div style={{
          fontSize: 8, letterSpacing: "0.14em", color: "#7C8B9E",
          textTransform: "uppercase", fontWeight: 500, whiteSpace: "nowrap",
        }}>
          The Verified Operating System
        </div>
      </div>

      {/* Badge + Hero */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, textAlign: "center" }}>
        <span style={{
          border: "1px solid rgba(176,82,74,0.6)", color: "#C46E5E",
          fontSize: 9, letterSpacing: "0.11em", fontWeight: 600,
          padding: "4px 13px", borderRadius: 999, textTransform: "uppercase", whiteSpace: "nowrap",
        }}>
          The Next Layer
        </span>
        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            Citizen Agent
          </h1>
          <p style={{ fontSize: 12.5, color: "#AEB9C8", lineHeight: 1.45, margin: 0, maxWidth: 260 }}>
            The action layer of Modveon's Verified Operating System.
          </p>
        </div>
      </div>

      {/* Verified Access card */}
      <div style={{
        border: "1px solid rgba(124,139,158,0.22)", borderRadius: 13, padding: "11px 13px",
        display: "flex", alignItems: "center", gap: 11, background: "rgba(44,67,99,0.28)",
      }}>
        <div style={{
          width: 36, height: 36, background: "linear-gradient(145deg, #3C7D5A, #2C5F43)",
          borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, boxShadow: "0 0 0 4px rgba(60,125,90,0.14)",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#4FA77B", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>
            Verified Access
          </div>
          <div style={{ fontSize: 12.5, color: "#E6EAF0", lineHeight: 1.35 }}>
            We verify every citizen's identity at onboarding.
          </div>
        </div>
      </div>

      {/* Divider + Capability cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ textAlign: "center", fontSize: 9, letterSpacing: "0.16em", color: "#7C8B9E", textTransform: "uppercase", fontWeight: 500, marginBottom: 2 }}>
          Understand · Reason · Act
        </div>

        {/* Row 1 — Understands */}
        <div style={{
          background: "rgba(44,67,99,0.38)", border: "1px solid rgba(124,139,158,0.16)",
          borderRadius: 12, padding: "9px 13px", display: "flex", alignItems: "center", gap: 11,
        }}>
          <div style={{ width: 32, height: 32, background: "rgba(127,168,201,0.1)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9FB3C9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span style={{ fontSize: 12.5, color: "#E6EAF0", fontWeight: 500, lineHeight: 1.3 }}>Understands your situation</span>
        </div>

        {/* Row 2 — Reasons */}
        <div style={{
          background: "rgba(44,67,99,0.38)", border: "1px solid rgba(124,139,158,0.16)",
          borderRadius: 12, padding: "9px 13px", display: "flex", alignItems: "center", gap: 11,
        }}>
          <div style={{ width: 32, height: 32, background: "rgba(127,168,201,0.1)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9FB3C9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <div style={{ position: "absolute", right: -3, bottom: -3, width: 13, height: 13, background: "#4FA77B", borderRadius: "50%", border: "1.5px solid #213750", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <span style={{ fontSize: 12.5, color: "#E6EAF0", fontWeight: 500, lineHeight: 1.3 }}>Reasons over verified government information</span>
        </div>

        {/* Row 3 — Acts */}
        <div style={{
          background: "rgba(44,67,99,0.38)", border: "1px solid rgba(124,139,158,0.16)",
          borderRadius: 12, padding: "9px 13px", display: "flex", alignItems: "center", gap: 11,
        }}>
          <div style={{ width: 32, height: 32, background: "rgba(127,168,201,0.1)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9FB3C9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <span style={{ fontSize: 12.5, color: "#E6EAF0", fontWeight: 500, lineHeight: 1.3 }}>Acts across government on your behalf</span>
        </div>
      </div>

      {/* Tagline */}
      <p style={{ fontSize: 11, color: "#7C8B9E", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
        Answers found. Benefits surfaced. Processes completed.
      </p>

      {/* CTA + Footer */}
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <button
          onClick={() => router.push("/bermuda/proactive?presentation=1")}
          style={{
            width: "100%", background: "linear-gradient(180deg, #BA5A50, #A84A42)", color: "#fff",
            border: "none", borderRadius: 13, padding: 13, fontSize: 14.5, fontWeight: 700,
            fontFamily: FONT, cursor: "pointer", letterSpacing: "0.01em",
            boxShadow: "0 6px 20px rgba(176,82,74,0.32)", transition: "filter 0.15s, transform 0.1s",
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.94)" }}
          onMouseLeave={e => { e.currentTarget.style.filter = "none" }}
          onMouseDown={e => { e.currentTarget.style.transform = "scale(0.99)" }}
          onMouseUp={e => { e.currentTarget.style.transform = "none" }}
        >
          Launch Citizen Agent →
        </button>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "#6A7B8E", textTransform: "uppercase", fontWeight: 600 }}>
            Citizen Agent by Modveon
          </div>
          <div style={{ fontSize: 11, color: "#6A7B8E" }}>Part of the Verified Operating System</div>
        </div>
      </div>

    </div>
  )
}
