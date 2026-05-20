"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { lookupServices } from "@/lib/kb"
import { MessageSquare, ChevronRight, ChevronLeft, Check, Sparkles, ArrowRight, ChevronDown } from "lucide-react"

// ─── Data ────────────────────────────────────────────────

const SITUATIONS = [
  { value: "new-baby",       emoji: "👶", label: "Just had / expecting a baby" },
  { value: "job-loss",       emoji: "💼", label: "Recently lost a job" },
  { value: "start-business", emoji: "🏪", label: "Starting or running a business" },
  { value: "health",         emoji: "🏥", label: "Looking for health coverage" },
  { value: "general",        emoji: "📋", label: "Just exploring what I qualify for" },
]

const EMPLOYMENT = [
  { value: "employed",   label: "Employed (formal)" },
  { value: "unemployed", label: "Unemployed" },
  { value: "informal",   label: "Self-employed / informal" },
]

const GENDERS = [
  { value: "female",  label: "Female" },
  { value: "male",    label: "Male" },
  { value: "other",   label: "Non-binary / other" },
  { value: "no-say",  label: "Prefer not to say" },
]

// El Salvador departments
const SV_DEPARTMENTS = [
  "Ahuachapán","Cabañas","Chalatenango","Cuscatlán","La Libertad",
  "La Paz","La Unión","Morazán","San Miguel","San Salvador",
  "San Vicente","Santa Ana","Sonsonate","Usulután",
]

const slide = {
  enter:  { opacity: 0, x: 28 },
  center: { opacity: 1, x: 0,   transition: { duration: 0.25, ease: "easeOut" } },
  exit:   { opacity: 0, x: -28, transition: { duration: 0.18 } },
}

// ─── Main ─────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const { refresh } = useCitizen()

  const STEPS = 4
  const [step,       setStep]       = useState(0)
  const [name,       setName]       = useState("")
  const [situation,  setSituation]  = useState("")
  const [employment, setEmployment] = useState("")
  const [email,      setEmail]      = useState("")
  const [gender,     setGender]     = useState("")
  const [department, setDepartment] = useState("")
  const [saving,     setSaving]     = useState(false)

  // Derive life event for KB lookup (health / general → any
  const lifeEventForKB = ["new-baby","job-loss","start-business"].includes(situation)
    ? situation : "new-baby"  // fallback to show some results

  const benefits = situation
    ? lookupServices({ country: "SV", lifeEvent: lifeEventForKB, employment: employment || "any" })
    : []

  const canStep0 = name.trim().length > 0
  const canStep1 = situation !== "" && employment !== ""
  // Step 2 (profile) is always optional — can always advance

  const next = () => setStep(s => Math.min(s + 1, STEPS - 1))
  const back = () => setStep(s => Math.max(s - 1, 0))
  const skip = () => { localStorage.setItem("ca_show_tour", "1"); router.push("/chat") }

  const handleFinish = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/citizen/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: name, country: "SV", email, gender, language: "en" }),
      })
      const data = await res.json()
      if (data.citizenId) {
        localStorage.setItem("ca_citizen_id", data.citizenId)
        // Also persist in a long-lived cookie so the ID survives
        // localStorage clears (private browsing, browser wipes, etc.)
        document.cookie = `ca_citizen_id=${data.citizenId}; max-age=31536000; path=/; SameSite=Lax`
      }

      await fetch("/api/context/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenId: data.citizenId,
          lifeEvent: situation === "general" || situation === "health" ? null : situation,
          employment,
          entitlements: benefits.map(b => ({ serviceId: b.id, status: "new" })),
        }),
      })

      // Save extended profile fields
      if (department || gender) {
        await fetch("/api/citizen/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-citizen-id": data.citizenId },
          body: JSON.stringify({ gender, department }),
        }).catch(() => {})
      }

      await refresh()
      const dest = localStorage.getItem("ca_after_onboard") || "chat"
      localStorage.removeItem("ca_after_onboard")
      if (dest === "dashboard") {
        router.push("/dashboard")
      } else {
        localStorage.setItem("ca_show_tour", "1")
        router.push("/chat")
      }
    } catch {
      router.push("/chat")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 to-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <div className="flex items-center gap-2 text-[#185FA5] font-semibold text-sm">
          <MessageSquare size={16} />
          Citizen Assist
        </div>
        <button onClick={skip} className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100">
          Skip for now
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 py-3">
        {Array.from({ length: STEPS }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
            i === step ? "w-5 bg-[#185FA5]" : i < step ? "w-2 bg-blue-300" : "w-2 bg-gray-200"
          }`} />
        ))}
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-4 pt-4 pb-10">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait" initial={false}>

            {/* ── STEP 0: Name ─────────────────────── */}
            {step === 0 && (
              <motion.div key="s0" variants={slide} initial="enter" animate="center" exit="exit" className="space-y-5">
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#185FA5] flex items-center justify-center mx-auto shadow-lg shadow-blue-200">
                    <MessageSquare size={24} className="text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Hi there 👋</h1>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    I know every government benefit you qualify for in El Salvador — and exactly how to get them.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    What's your first name?
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canStep0 && next()}
                    placeholder="e.g. María"
                    className="w-full border-2 border-gray-200 focus:border-[#185FA5] rounded-2xl px-4 py-3.5 text-lg font-medium focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                  />
                </div>

                <button
                  onClick={next}
                  disabled={!canStep0}
                  className="w-full flex items-center justify-center gap-2 bg-[#185FA5] hover:bg-[#145290] text-white py-3.5 rounded-2xl font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-blue-100"
                >
                  Continue <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {/* ── STEP 1: Situation ────────────────── */}
            {step === 1 && (
              <motion.div key="s1" variants={slide} initial="enter" animate="center" exit="exit" className="space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">What's your situation, {name}?</h1>
                  <p className="text-gray-400 text-sm mt-0.5">Pick the one that fits best — you can change it later.</p>
                </div>

                <div className="space-y-2">
                  {SITUATIONS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setSituation(s.value)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border-2 text-left transition-all ${
                        situation === s.value
                          ? "border-[#185FA5] bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span className="text-xl flex-shrink-0">{s.emoji}</span>
                      <span className={`font-medium text-sm ${situation === s.value ? "text-[#185FA5]" : "text-gray-700"}`}>
                        {s.label}
                      </span>
                      {situation === s.value && <Check size={14} className="ml-auto text-[#185FA5] flex-shrink-0" />}
                    </button>
                  ))}
                </div>

                {/* Employment — progressive disclosure */}
                <AnimatePresence>
                  {situation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-2"
                    >
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employment status</p>
                      <div className="grid grid-cols-3 gap-2">
                        {EMPLOYMENT.map(e => (
                          <button
                            key={e.value}
                            onClick={() => setEmployment(e.value)}
                            className={`py-2.5 px-1 rounded-xl border-2 text-center text-xs font-semibold transition-all ${
                              employment === e.value
                                ? "border-[#185FA5] bg-blue-50 text-[#185FA5]"
                                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            {e.label.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Benefit counter */}
                <AnimatePresence>
                  {benefits.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5"
                    >
                      <Sparkles size={16} className="text-emerald-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-emerald-700">
                        Found {benefits.length} benefits for you!
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2 pt-1">
                  <button onClick={back} className="px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-400 hover:border-gray-300 transition-all">
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={next}
                    disabled={!canStep1}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#185FA5] hover:bg-[#145290] text-white py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-blue-100"
                  >
                    Continue <ArrowRight size={15} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: Profile details ──────────── */}
            {step === 2 && (
              <motion.div key="s2" variants={slide} initial="enter" animate="center" exit="exit" className="space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">A little more about you</h1>
                  <p className="text-gray-400 text-sm mt-0.5">
                    All optional — helps us find location-specific and gender-targeted benefits.
                  </p>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email (for deadline reminders)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full border-2 border-gray-200 focus:border-[#185FA5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENDERS.map(g => (
                      <button
                        key={g.value}
                        onClick={() => setGender(gender === g.value ? "" : g.value)}
                        className={`py-2.5 px-3 rounded-xl border-2 text-left text-xs font-medium transition-all ${
                          gender === g.value
                            ? "border-[#185FA5] bg-blue-50 text-[#185FA5]"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Department / location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Department <span className="text-gray-300 font-normal normal-case">(El Salvador)</span>
                  </label>
                  <div className="relative">
                    <select
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      className="w-full border-2 border-gray-200 focus:border-[#185FA5] rounded-xl px-4 py-2.5 text-sm focus:outline-none appearance-none bg-white text-gray-700 transition-all"
                    >
                      <option value="">Select your department</option>
                      {SV_DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={back} className="px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-400 hover:border-gray-300 transition-all">
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={next}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#185FA5] hover:bg-[#145290] text-white py-3 rounded-2xl font-semibold text-sm transition-all shadow-md shadow-blue-100"
                  >
                    See my benefits <ArrowRight size={15} />
                  </button>
                </div>

                <button onClick={next} className="w-full text-center text-xs text-gray-400 hover:text-gray-500 py-1 transition-colors">
                  Skip this step →
                </button>
              </motion.div>
            )}

            {/* ── STEP 3: First win ────────────────── */}
            {step === 3 && (
              <motion.div key="s3" variants={slide} initial="enter" animate="center" exit="exit" className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <Sparkles size={26} className="text-emerald-500" />
                  </div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {name}, {benefits.length > 0 ? `I found ${benefits.length} benefits for you!` : "let's find your benefits."}
                  </h1>
                  <p className="text-gray-400 text-xs">Here are the benefits you qualify for:</p>
                </div>

                <div className="space-y-2">
                  {benefits.length > 0 && benefits.slice(0, 3).map((b, i) => (
                    <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[11px] font-bold text-[#185FA5]">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 leading-tight">{b.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{b.agency}</p>
                      </div>
                      {b.amount && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex-shrink-0">
                          {b.amount}
                        </span>
                      )}
                    </div>
                  ))}
                  {benefits.length > 3 && (
                    <p className="text-xs text-center text-gray-400">+ {benefits.length - 3} more in your plan</p>
                  )}
                </div>

                {benefits.find(b => b.deadlineDays && b.deadlineDays <= 30) && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs text-red-700 font-medium">
                    ⚡ One benefit has an urgent deadline — act within {benefits.find(b => b.deadlineDays)?.deadlineDays} days.
                  </div>
                )}

                {/* Primary CTA → agent */}
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-[#185FA5] hover:bg-[#145290] text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-md shadow-blue-100 disabled:opacity-60"
                >
                  {saving ? "Setting up..." : "Ask the agent →"}
                </button>

                {/* Secondary — dashboard */}
                <button
                  onClick={() => {
                    localStorage.setItem("ca_after_onboard", "dashboard")
                    handleFinish()
                  }}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
                >
                  View in dashboard instead
                </button>

                <button onClick={back} className="w-full text-center text-xs text-gray-300 hover:text-gray-400 py-0.5 transition-colors">
                  ← Back
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
