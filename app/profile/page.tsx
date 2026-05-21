"use client"

import { useState, useEffect } from "react"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import { Check, Loader2, User, ChevronDown, Sparkles } from "lucide-react"

const LIFE_EVENTS = [
  { value: "new-baby",       emoji: "👶", label: "New baby / expecting" },
  { value: "job-loss",       emoji: "💼", label: "Recently lost a job" },
  { value: "start-business", emoji: "🏪", label: "Starting a business" },
  { value: "health",         emoji: "🏥", label: "Looking for health coverage" },
  { value: "general",        emoji: "📋", label: "Just exploring benefits" },
]

const EMPLOYMENT_OPTIONS = [
  { value: "employed",   label: "Employed (formal)" },
  { value: "unemployed", label: "Unemployed" },
  { value: "informal",   label: "Self-employed / informal" },
]

const SALARY_RANGES = [
  { value: "0-300",      label: "Under $300 / mo" },
  { value: "300-600",    label: "$300 – $600 / mo" },
  { value: "600-1200",   label: "$600 – $1,200 / mo" },
  { value: "1200-plus",  label: "Over $1,200 / mo" },
  { value: "no-say",     label: "Prefer not to say" },
]

const FAMILY_STATUS = [
  { value: "single",           label: "Single, no dependents" },
  { value: "single-dependents", label: "Single with dependents" },
  { value: "married",          label: "Married / partnered" },
  { value: "married-dependents", label: "Married with children" },
]

const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male",   label: "Male" },
  { value: "other",  label: "Non-binary / other" },
  { value: "no-say", label: "Prefer not to say" },
]

const SV_DEPARTMENTS = [
  "Ahuachapán","Cabañas","Chalatenango","Cuscatlán","La Libertad",
  "La Paz","La Unión","Morazán","San Miguel","San Salvador",
  "San Vicente","Santa Ana","Sonsonate","Usulután",
]

export default function ProfilePage() {
  const { lang } = useLang()
  const { citizen, refresh } = useCitizen()
  const tr = t(lang)

  const [firstName,     setFirstName]     = useState("")
  const [email,         setEmail]         = useState("")
  const [gender,        setGender]        = useState("")
  const [department,    setDepartment]    = useState("")
  const [lifeEvent,     setLifeEvent]     = useState("")
  const [employment,    setEmployment]    = useState("")
  const [salaryRange,   setSalaryRange]   = useState("")
  const [familyStatus,  setFamilyStatus]  = useState("")
  const [dependents,    setDependents]    = useState("")
  const [whatsapp,      setWhatsapp]      = useState("")
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)

  useEffect(() => {
    if (citizen) {
      setFirstName(citizen.profile.firstName || "")
      setEmail(citizen.profile.email || "")
      setLifeEvent(citizen.profile.lifeEvent || "")
      setEmployment(citizen.profile.employment || "")
      if (citizen.profile.gender) setGender(citizen.profile.gender)
    }
  }, [citizen])

  const handleSave = async () => {
    const citizenId = localStorage.getItem("ca_citizen_id")
    if (!citizenId) return
    setSaving(true)
    try {
      await fetch("/api/citizen/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-citizen-id": citizenId },
        body: JSON.stringify({
          firstName, email, gender, language: lang,
          lifeEvent, employment,
          // Extended fields stored as metadata
          department, salaryRange, familyStatus, dependents, whatsapp,
        }),
      })
      await refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <User size={18} className="text-[#185FA5]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
              <p className="text-sm text-gray-400 mt-0.5">The more we know, the more benefits we can find for you</p>
            </div>
          </div>
          <a href="/preview" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-colors">
            <Sparkles size={12} />Preview
          </a>
        </div>
      </div>

      {/* Profile completion */}
      {(() => {
        const mandatoryFields = [
          { key: "firstName",  label: "Name",        filled: !!citizen?.profile?.firstName && citizen.profile.firstName !== "there" },
          { key: "lifeEvent",  label: "Situation",   filled: !!citizen?.profile?.lifeEvent },
          { key: "employment", label: "Employment",  filled: citizen?.profile?.employment !== "any" && !!citizen?.profile?.employment },
        ]
        const optionalFields = [
          { key: "email",       label: "Email",         filled: !!citizen?.profile?.email || !!email, optional: true },
          { key: "gender",      label: "Gender",        filled: !!citizen?.profile?.gender || !!gender, optional: true },
          { key: "department",  label: "Department",    filled: !!department, optional: true },
          { key: "whatsapp",    label: "WhatsApp",      filled: !!whatsapp, optional: true },
          { key: "salary",      label: "Salary range",  filled: !!salaryRange, optional: true },
          { key: "family",      label: "Family status", filled: !!familyStatus, optional: true },
        ]
        const allFields = [...mandatoryFields, ...optionalFields]
        const filledCount = allFields.filter(f => f.filled).length
        const completionPct = Math.round((filledCount / allFields.length) * 100)
        const missingMandatory = mandatoryFields.filter(f => !f.filled)
        const missingOptional = optionalFields.filter(f => !f.filled)
        return (
          <div className="bg-white border-b border-gray-100 px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {lang === "es" ? "Perfil completo" : "Profile complete"}
              </span>
              <span className="text-sm font-semibold text-[#185FA5]">{completionPct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${completionPct}%`,
                  background: completionPct === 100 ? "#10b981" : "#185FA5",
                }}
              />
            </div>
            {completionPct < 100 && (
              <p className="text-xs text-gray-400 mt-1.5">
                {missingMandatory.length > 0 && (
                  <>{lang === "es" ? "Requerido:" : "Required:"} {missingMandatory.map(f => f.label).join(", ")}</>
                )}
                {missingMandatory.length > 0 && missingOptional.length > 0 && " · "}
                {missingOptional.length > 0 && (
                  <>{lang === "es" ? "Opcional:" : "Optional:"} {missingOptional.map(f => f.label).join(", ")}</>
                )}
              </p>
            )}
          </div>
        )
      })()}

      <div className="max-w-lg mx-auto px-4 py-5 space-y-3 pb-10">

        {/* ── BASICS ─────────────────────────────── */}
        <SectionLabel>Basic info</SectionLabel>

        <FormCard>
          <FieldLabel>First name</FieldLabel>
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className={inputCls}
          />
        </FormCard>

        <FormCard>
          <FieldLabel>Email <OptTag /></FieldLabel>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className={inputCls}
          />
          <p className="text-xs text-gray-400 mt-1">Used for deadline reminders only.</p>
        </FormCard>

        <FormCard>
          <FieldLabel>WhatsApp <OptTag /></FieldLabel>
          <input
            type="tel"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            placeholder="+503 7000 0000"
            className={inputCls}
          />
        </FormCard>

        <FormCard>
          <FieldLabel>Gender <OptTag /></FieldLabel>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {GENDERS.map(g => (
              <ToggleButton
                key={g.value}
                label={g.label}
                active={gender === g.value}
                onClick={() => setGender(gender === g.value ? "" : g.value)}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Some benefits are gender-specific.</p>
        </FormCard>

        {/* ── LOCATION ───────────────────────────── */}
        <SectionLabel>Location</SectionLabel>

        <FormCard>
          <FieldLabel>Department — El Salvador <OptTag /></FieldLabel>
          <div className="relative mt-1">
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className={`${inputCls} appearance-none pr-8`}
            >
              <option value="">Select department</option>
              {SV_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <p className="text-xs text-gray-400 mt-1">Some benefits vary by municipality.</p>
        </FormCard>

        {/* ── SITUATION ──────────────────────────── */}
        <SectionLabel>Your situation</SectionLabel>

        <FormCard>
          <FieldLabel>What best describes you right now?</FieldLabel>
          <div className="space-y-1.5 mt-1">
            {LIFE_EVENTS.map(ev => (
              <button
                key={ev.value}
                onClick={() => setLifeEvent(lifeEvent === ev.value ? "" : ev.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm ${
                  lifeEvent === ev.value
                    ? "border-[#185FA5] bg-blue-50 text-[#185FA5] font-medium"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <span>{ev.emoji}</span>
                <span className="flex-1">{ev.label}</span>
                {lifeEvent === ev.value && <Check size={13} className="flex-shrink-0" />}
              </button>
            ))}
          </div>
        </FormCard>

        {/* ── EMPLOYMENT & INCOME ────────────────── */}
        <SectionLabel>Work & income</SectionLabel>

        <FormCard>
          <FieldLabel>Employment status</FieldLabel>
          <div className="space-y-1.5 mt-1">
            {EMPLOYMENT_OPTIONS.map(e => (
              <ToggleButton
                key={e.value}
                label={e.label}
                active={employment === e.value}
                onClick={() => setEmployment(e.value)}
                fullWidth
              />
            ))}
          </div>
        </FormCard>

        <FormCard>
          <FieldLabel>Monthly salary range <OptTag /></FieldLabel>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {SALARY_RANGES.map(s => (
              <ToggleButton
                key={s.value}
                label={s.label}
                active={salaryRange === s.value}
                onClick={() => setSalaryRange(salaryRange === s.value ? "" : s.value)}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Helps calculate exact benefit amounts.</p>
        </FormCard>

        {/* ── FAMILY ─────────────────────────────── */}
        <SectionLabel>Family</SectionLabel>

        <FormCard>
          <FieldLabel>Family status <OptTag /></FieldLabel>
          <div className="space-y-1.5 mt-1">
            {FAMILY_STATUS.map(f => (
              <ToggleButton
                key={f.value}
                label={f.label}
                active={familyStatus === f.value}
                onClick={() => setFamilyStatus(familyStatus === f.value ? "" : f.value)}
                fullWidth
              />
            ))}
          </div>
        </FormCard>

        <FormCard>
          <FieldLabel>Number of dependents <OptTag /></FieldLabel>
          <div className="flex gap-2 mt-1">
            {["0","1","2","3","4","5+"].map(n => (
              <button
                key={n}
                onClick={() => setDependents(dependents === n ? "" : n)}
                className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  dependents === n
                    ? "border-[#185FA5] bg-blue-50 text-[#185FA5]"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </FormCard>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-[#185FA5] hover:bg-[#145290] text-white py-3.5 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60 shadow-md shadow-blue-100 mt-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <><Check size={16} /> Saved!</> : "Save changes"}
        </button>
      </div>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────

const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#185FA5] focus:ring-2 focus:ring-blue-50 transition-all bg-white"

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 pt-2">{children}</p>
  )
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 space-y-1">
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
      {children}
    </label>
  )
}

function OptTag() {
  return <span className="text-gray-300 font-normal normal-case tracking-normal">optional</span>
}

function ToggleButton({ label, active, onClick, fullWidth }: {
  label: string; active: boolean; onClick: () => void; fullWidth?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`${fullWidth ? "w-full text-left" : ""} px-3.5 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
        active
          ? "border-[#185FA5] bg-blue-50 text-[#185FA5]"
          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
      }`}
    >
      {label}
    </button>
  )
}
