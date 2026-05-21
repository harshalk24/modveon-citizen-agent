"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import { motion, useInView, AnimatePresence } from "framer-motion"
import { ArrowRight, MessageSquare, Sparkles, Clock, CheckCircle2 } from "lucide-react"

/* ── Scroll-triggered fade-up ───────────────────────────── */
function FadeUp({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Animated app mockup for hero ───────────────────────── */
function HeroMockup() {
  const [stage, setStage] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)

  // Loops: show message → scanning → results → restart
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 1600)
    const t2 = setTimeout(() => setStage(2), 3000)
    const t3 = setTimeout(() => {
      setStage(0)
      setCycleKey(k => k + 1)
    }, 8500)
    return () => [t1, t2, t3].forEach(clearTimeout)
  }, [cycleKey])

  return (
    <div className="relative w-full max-w-[300px] mx-auto select-none">
      {/* Glow */}
      <div className="absolute inset-0 bg-[#1B3A8C]/20 blur-[60px] rounded-full scale-75 translate-y-10 pointer-events-none" />

      <div className="relative bg-[#111827] rounded-2xl p-5 shadow-2xl shadow-black/60 border border-white/8">

        {/* Header bar */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/8">
          <div className="w-5 h-5 rounded-md bg-[#1B3A8C] flex items-center justify-center">
            <MessageSquare size={9} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-white/60">Citizen Assist</span>
          <div className="ml-auto flex gap-1">
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
          </div>
        </div>

        {/* User message */}
        <motion.div
          key={`msg-${cycleKey}`}
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="flex justify-end mb-3"
        >
          <div className="bg-[#1B3A8C] rounded-2xl rounded-tr-sm px-3.5 py-2 max-w-[80%]">
            <p className="text-xs text-white leading-snug">I just had a baby 👶</p>
          </div>
        </motion.div>

        {/* Scanning dots */}
        <AnimatePresence>
          {stage === 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-1 py-2 mb-1"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-[#1B3A8C]/70 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 130}ms` }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-white/35">Scanning SV programs…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {stage === 2 && (
            <motion.div
              key={`results-${cycleKey}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-2"
            >
              {/* Found banner */}
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                <Sparkles size={11} className="text-emerald-400 flex-shrink-0" />
                <p className="text-xs font-semibold text-emerald-400">Found 6 benefits for you!</p>
              </div>

              {/* Benefit rows */}
              {[
                { name: "ISSS Maternity Leave",     val: "$400/mo" },
                { name: "RNPN Birth Registration",  val: "Free"    },
                { name: "Lactancia subsidy",         val: "$50/mo"  },
              ].map((b, i) => (
                <motion.div
                  key={b.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12 + 0.1 }}
                  className="flex items-center justify-between bg-white/4 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={10} className="text-[#185FA5] flex-shrink-0" />
                    <span className="text-[10px] text-white/65">{b.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400">{b.val}</span>
                </motion.div>
              ))}

              {/* Urgency pill */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5"
              >
                <Clock size={10} className="text-red-400 flex-shrink-0" />
                <span className="text-[10px] text-red-400 font-medium">RNPN deadline: 23 days ⚡</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ── Feature card data (duplicated for seamless marquee) ── */
const CARDS = [
  {
    bg: "bg-[#1B3A8C]",
    label: "Benefits finder",
    headline: "Every benefit.\nSurfaced instantly.",
    body: "We match your profile against every government program in El Salvador and surface everything you qualify for.",
    pill: "6 benefits found",
    pillSub: "New baby · ISSS · RNPN",
    light: false,
  },
  {
    bg: "bg-[#0A0E1A]",
    label: "Action plan",
    headline: "A plan,\nnot a list.",
    body: "Sequenced steps with deadlines, required documents, agency addresses, and what to say at the counter.",
    pill: "3 of 8 steps done",
    pillSub: "Next: RNPN registration",
    light: false,
  },
  {
    bg: "bg-white",
    label: "Deadline tracking",
    headline: "Never miss\na window.",
    body: "We track every deadline and alert you before you lose eligibility — automatically.",
    pill: "23 days left",
    pillSub: "RNPN birth registration",
    light: true,
  },
  {
    bg: "bg-[#EBF4FF]",
    label: "Ask the agent",
    headline: "Plain answers\nin seconds.",
    body: "Any question about a benefit, document, or process — answered in plain language, English or Spanish.",
    pill: "¿Cuánto me paga el ISSS?",
    pillSub: "100% of base salary · 12 wks",
    light: true,
  },
]

/* ══════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#EBF2FA] font-sans overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1B3A8C] flex items-center justify-center">
              <MessageSquare size={13} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">Citizen Assist</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/chat" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
              Sign in
            </Link>
            <Link
              href="/chat"
              className="text-sm font-bold bg-[#FFC400] hover:bg-[#E5AF00] text-yellow-900 px-4 py-2 rounded-full transition-colors shadow-sm shadow-yellow-200"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO DARK CARD ──────────────────────────────── */}
      <section className="px-3 pt-3">
        <div className="relative bg-[#0A0E1A] rounded-[2rem] overflow-hidden min-h-[90vh] flex flex-col">

          {/* Animated blobs */}
          <div className="absolute -top-32 -left-20 w-[500px] h-[500px] rounded-full bg-[#1B3A8C]/22 blur-[90px] animate-blob pointer-events-none" />
          <div className="absolute top-10 right-0  w-[400px] h-[400px] rounded-full bg-[#0C3870]/45 blur-[75px] animate-blob-slow animation-delay-2 pointer-events-none" />
          <div className="absolute bottom-0  left-1/3 w-[350px] h-[350px] rounded-full bg-[#1B3A8C]/12 blur-[100px] animate-blob animation-delay-4 pointer-events-none" />

          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />

          {/* Two-column content */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center max-w-6xl mx-auto px-6 pt-20 pb-10 flex-1">

            {/* LEFT: copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/50 mb-8"
              >
                🇸🇻 El Salvador · Powered by AI
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="text-[clamp(2.5rem,5vw,4.2rem)] font-extrabold text-white leading-[1.06] tracking-tight mb-6"
              >
                El Salvador has<br />
                benefits for you.<br />
                <span className="text-[#5BA8F0]">Most people never find them.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
                className="text-[1rem] text-white/42 max-w-md mb-10 leading-relaxed"
              >
                Navigating government benefits in El Salvador is confusing and time-consuming. We fix that — describe your situation once and we surface every program you qualify for, instantly.
              </motion.p>

            </div>

            {/* RIGHT: animated mockup */}
            <motion.div
              initial={{ opacity: 0, x: 32, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:flex items-center justify-center"
            >
              <HeroMockup />
            </motion.div>
          </div>

          {/* Full-width centered CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="relative z-10 flex flex-col items-center gap-3 pb-16"
          >
            <Link
              href="/chat"
              className="flex items-center gap-2 bg-[#FFC400] hover:bg-[#E5AF00] text-yellow-900 px-8 py-3.5 rounded-full font-bold text-[0.95rem] transition-all shadow-lg shadow-yellow-500/30 active:scale-[0.97]"
            >
              Find my benefits <ArrowRight size={17} />
            </Link>
            <a href="#how" className="text-sm text-white/35 hover:text-white/60 transition-colors">
              See how it works ↓
            </a>
            <p className="text-xs text-white/22 mt-1">
              No account required · Free · Takes 30 seconds
            </p>
          </motion.div>

        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────── */}
      <FadeUp className="py-16 px-6">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-6 text-center">
          {[
            { stat: "5 benefits", sub: "found per session on avg"  },
            { stat: "$1,400/mo",  sub: "avg unclaimed value"        },
            { stat: "30 sec",     sub: "to your first result"       },
          ].map((item, i) => (
            <div key={i}>
              <p className="text-3xl sm:text-4xl font-extrabold text-[#0A0E1A] tracking-tight">{item.stat}</p>
              <p className="text-xs text-gray-500 mt-1.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </FadeUp>

      {/* ── BIG STATEMENT ───────────────────────────────── */}
      <FadeUp className="py-6 px-6 text-center" id="how">
        <div className="max-w-5xl mx-auto" id="how">
          <h2 className="text-[clamp(2.2rem,6vw,4.4rem)] font-extrabold text-[#0A0E1A] leading-[1.08] tracking-tight">
            Government benefits,<br />
            <span className="text-[#0EA5E9]">finally explained.</span>
          </h2>
          <p className="text-gray-500 mt-4 text-base max-w-md mx-auto leading-relaxed">
            Tell us your situation. We do the research, find the programs, and hand you a step-by-step plan.
          </p>
        </div>
      </FadeUp>

      {/* ── MARQUEE FEATURE CARDS ───────────────────────── */}
      <section className="py-14 overflow-hidden">
        {/* Edge fades */}
        <div className="relative">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#EBF2FA] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#EBF2FA] to-transparent" />

          {/* Scrolling row — duplicated for seamless loop */}
          <div className="flex gap-5 animate-marquee hover:[animation-play-state:paused]">
            {[...CARDS, ...CARDS].map((card, i) => (
              <div
                key={i}
                className={`
                  flex-shrink-0 w-[280px] sm:w-[320px] rounded-[1.4rem] p-6
                  flex flex-col justify-between h-[380px]
                  ${card.bg}
                  ${card.light ? "border border-gray-200/80 shadow-sm" : ""}
                `}
              >
                <div>
                  <span
                    className={`
                      text-[0.6rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full
                      ${card.light ? "bg-gray-100 text-gray-500" : "bg-white/10 text-white/55"}
                    `}
                  >
                    {card.label}
                  </span>
                  <h3
                    className={`
                      text-[1.35rem] font-extrabold leading-tight mt-4 mb-3 whitespace-pre-line
                      ${card.light ? "text-[#0A0E1A]" : "text-white"}
                    `}
                  >
                    {card.headline}
                  </h3>
                  <p className={`text-sm leading-relaxed ${card.light ? "text-gray-500" : "text-white/48"}`}>
                    {card.body}
                  </p>
                </div>

                <div
                  className={`
                    px-4 py-3 rounded-2xl border
                    ${card.light ? "bg-gray-50/80 border-gray-200" : "bg-white/6 border-white/8"}
                  `}
                >
                  <p className={`text-[0.9rem] font-bold ${card.light ? "text-[#0A0E1A]" : "text-white"}`}>
                    {card.pill}
                  </p>
                  <p className={`text-[0.7rem] mt-0.5 ${card.light ? "text-gray-400" : "text-white/38"}`}>
                    {card.pillSub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM ─────────────────────────────────── */}
      <FadeUp className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-[0.68rem] font-bold text-gray-400 uppercase tracking-widest text-center mb-3">The problem</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0A0E1A] text-center mb-10 tracking-tight">
            Most Salvadorans leave money on the table
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: "Only 30% know what they qualify for",
                body: "Most benefits go unclaimed — not because they don't exist, but because nobody explains them.",
              },
              {
                title: "One wrong document means starting over",
                body: "Cross-agency processes have hidden dependencies. Miss one step and you're back at the beginning.",
              },
              {
                title: "Managing SV affairs from abroad is a full-time job",
                body: "Poder notarial, property, consulate appointments — the information exists, but no one connects it.",
              },
            ].map((card, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200/70 shadow-sm hover:shadow-md hover:border-yellow-400 transition-all">
                <p className="text-sm font-semibold text-gray-900 mb-2 leading-snug">{card.title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      {/* ── PERSONAS ────────────────────────────────────── */}
      <FadeUp className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-[0.68rem] font-bold text-gray-400 uppercase tracking-widest text-center mb-10">
            Who uses Citizen Assist
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                name: "María",
                sub: "New mother · Soyapango",
                quote: "Found her maternity benefit and RNPN deadline in 30 seconds. Would have missed the 30-day window.",
              },
              {
                name: "José",
                sub: "Salvadoran in Los Angeles",
                quote: "Got the correct poder chain for a property sale — without paying a tramitador.",
              },
              {
                name: "Rosa",
                sub: "Food vendor · Santa Ana",
                quote: "Discovered a $2,500 CONAMYPE grant she didn't know existed. Applied before registering her business.",
              },
            ].map((p, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200/70 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#185FA5]">{p.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sub}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed italic">"{p.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      {/* ── FINAL CTA DARK CARD ─────────────────────────── */}
      <section className="px-3 pb-3">
        <FadeUp>
          <div className="relative bg-[#0A0E1A] rounded-[2rem] overflow-hidden py-24 text-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-[#1B3A8C]/14 blur-[90px] animate-blob-slow pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[300px] h-[200px] rounded-full bg-[#2B82D9]/10 blur-[70px] animate-blob animation-delay-2 pointer-events-none" />
            <div className="relative z-10 px-6">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
                Ready to find what you're owed?
              </h2>
              <p className="text-sm text-white/38 mb-10">
                Free forever · No account required · El Salvador
              </p>
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 bg-[#FFC400] hover:bg-[#E5AF00] text-yellow-900 px-8 py-4 rounded-full font-bold text-base transition-all shadow-lg shadow-yellow-500/30 active:scale-[0.97]"
              >
                Start the conversation <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#1B3A8C] flex items-center justify-center">
              <MessageSquare size={10} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-600">Citizen Assist</span>
          </div>
          <span className="text-xs text-gray-400">Free · No account required · El Salvador</span>
        </div>
      </footer>

    </div>
  )
}
