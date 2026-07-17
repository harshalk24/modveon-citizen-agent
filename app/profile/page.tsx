"use client"

import { useState, useEffect } from "react"
import { useLang } from "@/contexts/LanguageContext"
import { useCitizen } from "@/contexts/CitizenContext"
import { t } from "@/lib/i18n"
import { Check, Loader2, User, ChevronDown, Sparkles } from "lucide-react"

const LIFE_EVENTS = [
  { value: "new-baby",        emoji: "🍼", label: "New baby / expecting" },
  { value: "job-loss",        emoji: "💼", label: "Recently lost a job" },
  { value: "start-business",  emoji: "🏪", label: "Starting a business" },
  { value: "diaspora",        emoji: "🌎", label: "Managing from abroad" },
  { value: "marriage",        emoji: "💍", label: "Getting married" },
  { value: "death",           emoji: "⚫", label: "Family member passed away" },
  { value: "retirement",      emoji: "🏖️", label: "Retiring" },
  { value: "driving-license", emoji: "🚗", label: "Driver's license" },
  { value: "property",        emoji: "🏠", label: "Buying / selling property" },
  { value: "education",       emoji: "📚", label: "Education / training" },
  { value: "separation",      emoji: "💔", label: "Separation or divorce" },
  { value: "social-benefits", emoji: "🤝", label: "Social assistance / programs" },
  { value: "healthcare",      emoji: "🏥", label: "Looking for health coverage" },
]

const EMPLOYMENT_OPTIONS = [
  { value: "formal",     label: "Employed (formal)" },
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
  const isEs = lang === "es"

  const [firstName,     setFirstName]     = useState("")
  const [email,         setEmail]         = useState("")
  const [gender,        setGender]        = useState("")
  const [department,    setDepartment]    = useState("")
  const [municipality,  setMunicipality]  = useState("")
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
      setMunicipality(citizen.profile.municipality || "")
      if (citizen.profile.gender) setGender(citizen.profile.gender)
    }
  }, [citizen])

  // Auto-fix employment when life event implies unemployed
  useEffect(() => {
    if (lifeEvent === "job-loss") setEmployment("unemployed")
  }, [lifeEvent])

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
          lifeEvent, employment, municipality,
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

  // Spanish label lookups — English keeps each option's original literal
  // .label untouched (zero visual change for EN); Spanish resolves through
  // the corresponding tr.profile map, same fallback pattern plan.tsx already
  // uses for tr.profile.lifeEvents. Values (what gets saved) are untouched.
  const lifeEventLabel = (ev: { value: string; label: string }) =>
    isEs ? (tr.profile.lifeEvents[ev.value as keyof typeof tr.profile.lifeEvents] || ev.label) : ev.label
  const employmentLabelFor = (o: { value: string; label: string }) =>
    isEs ? (tr.profile.employment[o.value as keyof typeof tr.profile.employment] || o.label) : o.label
  const salaryLabel = (s: { value: string; label: string }) =>
    isEs ? (tr.profile.salaryRanges[s.value as keyof typeof tr.profile.salaryRanges] || s.label) : s.label
  const familyLabel = (f: { value: string; label: string }) =>
    isEs ? (tr.profile.familyStatuses[f.value as keyof typeof tr.profile.familyStatuses] || f.label) : f.label
  const genderLabel = (g: { value: string; label: string }) =>
    isEs ? (tr.profile.genders[g.value as keyof typeof tr.profile.genders] || g.label) : g.label

  return (
    <div className="h-screen overflow-y-auto bg-ca-surface-canvas">
      {/* Header */}
      <div className="bg-white border-b border-ca-surface-hairline px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">
              <User size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">{tr.profile.title}</h1>
              <p className="text-sm text-ca-text-secondary mt-0.5">{tr.profile.pageSubtitle}</p>
            </div>
          </div>
          <a href="/preview" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-ca-yellow text-ca-ink hover:bg-ca-yellow-hover transition-colors">
            <Sparkles size={12} />Preview
          </a>
        </div>
      </div>

      {/* Profile completion */}
      {(() => {
        const mandatoryFields = [
          { key: "firstName",  label: tr.profile.firstName,      filled: !!citizen?.profile?.firstName && citizen.profile.firstName !== "there" },
          { key: "lifeEvent",  label: tr.profile.sections.situation, filled: !!citizen?.profile?.lifeEvent },
          { key: "employment", label: tr.profile.employmentLabel,   filled: citizen?.profile?.employment !== "unknown" && !!citizen?.profile?.employment },
        ]
        const optionalFields = [
          { key: "email",       label: tr.profile.email,        filled: !!citizen?.profile?.email || !!email, optional: true },
          { key: "gender",      label: tr.profile.gender,        filled: !!citizen?.profile?.gender || !!gender, optional: true },
          { key: "department",  label: tr.profile.department,    filled: !!department, optional: true },
          { key: "municipality", label: tr.profile.municipality, filled: !!municipality, optional: true },
          { key: "whatsapp",    label: tr.profile.whatsapp,      filled: !!whatsapp, optional: true },
          { key: "salary",      label: tr.profile.salaryRange,   filled: !!salaryRange, optional: true },
          { key: "family",      label: tr.profile.familyStatus,  filled: !!familyStatus, optional: true },
        ]
        const allFields = [...mandatoryFields, ...optionalFields]
        const filledCount = allFields.filter(f => f.filled).length
        const completionPct = Math.round((filledCount / allFields.length) * 100)
        const missingMandatory = mandatoryFields.filter(f => !f.filled)
        const missingOptional = optionalFields.filter(f => !f.filled)
        return (
          <div className="bg-white border-b border-ca-surface-hairline px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-800">{tr.profile.completion}</span>
              <span className="text-sm font-bold text-brand">{completionPct}%</span>
            </div>
            <div className="h-2 bg-ca-track rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${completionPct === 100 ? "bg-ca-success" : "bg-brand"}`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            {completionPct < 100 && (
              <p className="text-xs text-ca-text-tertiary mt-1.5">
                {missingMandatory.length > 0 && (
                  <>{tr.profile.required} {missingMandatory.map(f => f.label).join(", ")}</>
                )}
                {missingMandatory.length > 0 && missingOptional.length > 0 && " · "}
                {missingOptional.length > 0 && (
                  <>{tr.profile.optionalLabel} {missingOptional.map(f => f.label).join(", ")}</>
                )}
              </p>
            )}
          </div>
        )
      })()}

      <div className="max-w-lg mx-auto px-4 py-5 space-y-3 pb-10">

        {/* ── BASICS ─────────────────────────────── */}
        <SectionLabel>{tr.profile.sections.basics}</SectionLabel>

        <FormCard>
          <FieldLabel>{tr.profile.firstName}</FieldLabel>
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className={inputCls}
          />
        </FormCard>

        <FormCard>
          <FieldLabel>{tr.profile.email} <OptTag tr={tr} /></FieldLabel>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className={inputCls}
          />
          <p className="text-xs text-ca-text-tertiary mt-1">{tr.profile.emailHelp}</p>
        </FormCard>

        <FormCard>
          <FieldLabel>{tr.profile.whatsapp} <OptTag tr={tr} /></FieldLabel>
          <input
            type="tel"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            placeholder="+503 7000 0000"
            className={inputCls}
          />
        </FormCard>

        <FormCard>
          <FieldLabel>{tr.profile.gender} <OptTag tr={tr} /></FieldLabel>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {GENDERS.map(g => (
              <ToggleButton
                key={g.value}
                label={genderLabel(g)}
                active={gender === g.value}
                onClick={() => setGender(gender === g.value ? "" : g.value)}
              />
            ))}
          </div>
          <p className="text-xs text-ca-text-tertiary mt-1.5">{tr.profile.genderHelp}</p>
        </FormCard>

        {/* ── LOCATION ───────────────────────────── */}
        <SectionLabel>{tr.profile.sections.location}</SectionLabel>

        <FormCard>
          <FieldLabel>{tr.profile.department} <OptTag tr={tr} /></FieldLabel>
          <div className="relative mt-1">
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className={`${inputCls} appearance-none pr-8`}
            >
              <option value="">{tr.profile.departmentPlaceholder}</option>
              {SV_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-ca-text-tertiary pointer-events-none" />
          </div>
          <p className="text-xs text-ca-text-tertiary mt-1">{tr.profile.departmentHelp}</p>
        </FormCard>

        <FormCard>
          <FieldLabel>{tr.profile.municipality} <OptTag tr={tr} /></FieldLabel>
          <input
            value={municipality}
            onChange={e => setMunicipality(e.target.value)}
            placeholder={tr.profile.municipalityPlaceholder}
            className={inputCls}
          />
          <p className="text-xs text-ca-text-tertiary mt-1">{tr.profile.municipalityHelp}</p>
        </FormCard>

        {/* ── SITUATION ──────────────────────────── */}
        <SectionLabel>{tr.profile.sections.situation}</SectionLabel>

        <FormCard>
          <FieldLabel>{tr.profile.situationQuestion}</FieldLabel>
          <div className="space-y-1.5 mt-1">
            {LIFE_EVENTS.map(ev => (
              <button
                key={ev.value}
                onClick={() => setLifeEvent(lifeEvent === ev.value ? "" : ev.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm break-words ${
                  lifeEvent === ev.value
                    ? "border-brand bg-brand-light text-brand font-medium"
                    : "border-ca-surface-input bg-white text-ca-text-secondary hover:border-ca-text-tertiary"
                }`}
              >
                <span className="flex-shrink-0">{ev.emoji}</span>
                <span className="flex-1 min-w-0">{lifeEventLabel(ev)}</span>
                {lifeEvent === ev.value && <Check size={13} className="flex-shrink-0" />}
              </button>
            ))}
          </div>
        </FormCard>

        {/* ── EMPLOYMENT & INCOME ────────────────── */}
        <SectionLabel>{tr.profile.sections.work}</SectionLabel>

        <FormCard>
          <FieldLabel>{tr.profile.employmentLabel}</FieldLabel>
          {lifeEvent === "job-loss" && (
            <p className="text-xs text-ca-warn bg-ca-warn-light border border-ca-warn-border rounded-lg px-3 py-2 mt-1">
              {tr.profile.employmentAutoNotePrefix}<strong>{tr.profile.employment.unemployed}</strong>{tr.profile.employmentAutoNoteSuffix}
            </p>
          )}
          <div className={`space-y-1.5 mt-1 ${lifeEvent === "job-loss" ? "opacity-40 pointer-events-none" : ""}`}>
            {EMPLOYMENT_OPTIONS.map(e => (
              <ToggleButton
                key={e.value}
                label={employmentLabelFor(e)}
                active={employment === e.value}
                onClick={() => setEmployment(e.value)}
                fullWidth
              />
            ))}
          </div>
        </FormCard>

        <FormCard>
          <FieldLabel>{tr.profile.salaryRange} <OptTag tr={tr} /></FieldLabel>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {SALARY_RANGES.map(s => (
              <ToggleButton
                key={s.value}
                label={salaryLabel(s)}
                active={salaryRange === s.value}
                onClick={() => setSalaryRange(salaryRange === s.value ? "" : s.value)}
              />
            ))}
          </div>
          <p className="text-xs text-ca-text-tertiary mt-1.5">{tr.profile.salaryHelp}</p>
        </FormCard>

        {/* ── FAMILY ─────────────────────────────── */}
        <SectionLabel>{tr.profile.sections.family}</SectionLabel>

        <FormCard>
          <FieldLabel>{tr.profile.familyStatus} <OptTag tr={tr} /></FieldLabel>
          <div className="space-y-1.5 mt-1">
            {FAMILY_STATUS.map(f => (
              <ToggleButton
                key={f.value}
                label={familyLabel(f)}
                active={familyStatus === f.value}
                onClick={() => setFamilyStatus(familyStatus === f.value ? "" : f.value)}
                fullWidth
              />
            ))}
          </div>
        </FormCard>

        <FormCard>
          <FieldLabel>{tr.profile.dependents} <OptTag tr={tr} /></FieldLabel>
          <div className="flex gap-2 mt-1">
            {["0","1","2","3","4","5+"].map(n => (
              <button
                key={n}
                onClick={() => setDependents(dependents === n ? "" : n)}
                className={`flex-1 min-w-0 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  dependents === n
                    ? "border-brand bg-brand-light text-brand"
                    : "border-ca-surface-input bg-white text-ca-text-secondary hover:border-ca-text-tertiary"
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
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white py-3.5 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60 shadow-lg shadow-brand/20 mt-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <><Check size={16} /> {tr.profile.saved}</> : tr.profile.save}
        </button>
      </div>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────

const inputCls = "w-full border border-ca-surface-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-light transition-all bg-white"

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-ca-text-tertiary uppercase tracking-wider px-1 pt-2">{children}</p>
  )
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-ca-surface-border shadow-[0_1px_3px_rgba(16,24,40,.05)] px-4 py-4 space-y-1">
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-ca-text-secondary uppercase tracking-wide flex flex-wrap items-center gap-x-1.5">
      {children}
    </label>
  )
}

function OptTag({ tr }: { tr: ReturnType<typeof t> }) {
  return <span className="text-ca-text-tertiary font-normal normal-case tracking-normal">{tr.profile.optional}</span>
}

function ToggleButton({ label, active, onClick, fullWidth }: {
  label: string; active: boolean; onClick: () => void; fullWidth?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`${fullWidth ? "w-full text-left" : ""} px-3.5 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all break-words ${
        active
          ? "border-brand bg-brand-light text-brand"
          : "border-ca-surface-input bg-white text-ca-text-secondary hover:border-ca-text-tertiary"
      }`}
    >
      {label}
    </button>
  )
}
