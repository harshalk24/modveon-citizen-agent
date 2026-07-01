"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { Send, Upload, CheckCircle2, MapPin, Briefcase, Calendar, DollarSign } from "lucide-react"
import PreviewMessageRenderer from "../preview/components/PreviewMessageRenderer"
import type { PreviewMessage, PreviewActivity, ChipOption } from "../preview/types"

let _id = 0
const uid   = (p = "pa") => `${p}_${++_id}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ── Job listings ──────────────────────────────────────────────────────────────
interface Job { id: string; title: string; department: string; location: string; salary: string; experience: string; deadline: string }

const JOBS: Job[] = [
  { id: "mgr-ops",   title: "Manager (Operations)",            department: "Cabinet Office — Digital Innovation",        location: "Hamilton, Bermuda", salary: "BMD $85,000 – $105,000 p.a.", experience: "5+ years in operations or public sector management",       deadline: "30 Jun 2026" },
  { id: "prog-mgr",  title: "Senior Programme Manager",        department: "Ministry of Economy and Labour",             location: "Hamilton, Bermuda", salary: "BMD $88,000 – $108,000 p.a.", experience: "5+ years in programme or project management",             deadline: "15 Jul 2026" },
  { id: "strat-mgr", title: "Manager (Strategy & Performance)",department: "Ministry of Finance",                        location: "Hamilton, Bermuda", salary: "BMD $82,000 – $100,000 p.a.", experience: "4+ years in strategy, performance or business management", deadline: "22 Jul 2026" },
  { id: "proj-mgr",  title: "Project Manager (Public Services)",department: "Department of Public Works",                location: "Hamilton, Bermuda", salary: "BMD $78,000 – $95,000 p.a.",  experience: "4+ years in project management or public administration", deadline: "10 Jul 2026" },
]

// ── Form field definitions ────────────────────────────────────────────────────
// Mirrors the actual govtcareers.gov.bm/apply form structure exactly
type SectionKey = "personal-info" | "employment" | "additional-info" | "privacy" | "references"

interface FieldDef {
  key:        string
  label:      string
  required?:  boolean
  value:      string
  type?:      "select" | "textarea" | "date"   // default = text
  options?:   string[]                          // for select
  fullWidth?: boolean
  hint?:      string                            // shown below textarea
  section:    SectionKey
}

const FIELDS: FieldDef[] = [
  // ── Section 1: Personal Information ────────────────────────────────────────
  {
    key: "govtEmployee", label: "Are you a current employee of the Government of Bermuda?",
    required: true, value: "No", type: "select",
    options: ["--Please Select--", "No", "Yes"],
    section: "personal-info",
  },
  {
    key: "qualification", label: "Qualification",
    value: "M.Sc. Public Administration", fullWidth: true, section: "personal-info",
  },
  {
    key: "dateObtained", label: "Date Obtained (estimated)",
    value: "20 / June / 2015", type: "date", section: "personal-info",
  },
  {
    key: "course", label: "Course (Special Courses undertaken relative to the post applied for)",
    value: "Lean Six Sigma Green Belt", fullWidth: true, section: "personal-info",
  },
  {
    key: "dateCourseCompleted", label: "Date Completed (estimated)",
    value: "15 / September / 2020", type: "date", section: "personal-info",
  },
  {
    key: "personalStatement",
    label: "Personal Statement (Please state briefly why you consider yourself suitable for this post and how your experience, qualifications and personal qualities match the requirements of the position)",
    value: "Through six years in operations management and a Master's in Public Administration, I have developed a strong foundation in process improvement and cross-functional leadership. I am eager to apply this experience within the public sector, contributing to the Cabinet Office's mission to modernise government service delivery.",
    type: "textarea", hint: "Characters left: 500", fullWidth: true, section: "personal-info",
  },

  // ── Section 2: Employment History ──────────────────────────────────────────
  {
    key: "employerName", label: "Employer Name",
    required: true, value: "Hamilton Business Consulting Ltd", fullWidth: true, section: "employment",
  },
  {
    key: "postHeld", label: "Post Held",
    required: true, value: "Operations Manager", section: "employment",
  },
  {
    key: "dateStarted", label: "Date Started (estimated)",
    value: "15 / March / 2019", type: "date", section: "employment",
  },
  {
    key: "reasonLeaving", label: "Reason for leaving",
    value: "Pursuing a career transition to the public sector to apply operational expertise to government service delivery and contribute to Bermuda's digital innovation agenda.",
    type: "textarea", hint: "Characters left: 4000", fullWidth: true, section: "employment",
  },

  // ── Section 3: Additional Information ──────────────────────────────────────
  {
    key: "lastName",  label: "Last Name",  required: true, value: "Blake",  section: "additional-info",
  },
  {
    key: "firstName", label: "First Name", required: true, value: "Jordan", section: "additional-info",
  },
  {
    key: "dateOfBirth", label: "Date of Birth",
    required: true, value: "08 / November / 1990", type: "date", section: "additional-info",
  },
  {
    key: "cityOfBirth", label: "City or Parish of Birth",
    required: true, value: "Hamilton", section: "additional-info",
  },
  {
    key: "nationality", label: "Nationality at Birth",
    required: true, value: "Bermudian", section: "additional-info",
  },
  {
    key: "passportNumber", label: "Passport Number",
    required: true, value: "BM789012", section: "additional-info",
  },
  {
    key: "socialInsurance", label: "Social Insurance / Security Number",
    value: "456-789-012", section: "additional-info",
  },
  {
    key: "homeAddresses",
    label: "Home addresses over the past ten (10) years, including dates (Text only no symbols i.e. #)",
    required: true,
    value: "45 Middle Road, Warwick, Bermuda (March 2019 to Present). 7 Cedar Avenue, Devonshire, Bermuda (August 2015 to March 2019).",
    type: "textarea", hint: "Characters left: 4000", fullWidth: true, section: "additional-info",
  },

  // ── Section 4: Data Privacy Statement ──────────────────────────────────────
  {
    key: "dataPrivacy",
    label: "By selecting \"I agree\" you confirm that you have read, understand and consent to the Data Privacy Statement.",
    required: true, value: "I agree", type: "select",
    options: ["Please agree", "I agree"],
    fullWidth: true, section: "privacy",
  },

  // ── Section 5: References — left blank for user to complete ─────────────────
  { key: "referee1Name", label: "Referee 1 — Full Name",    value: "", section: "references" },
  { key: "referee1Org",  label: "Organisation / Job Title", value: "", section: "references" },
  { key: "referee2Name", label: "Referee 2 — Full Name",    value: "", section: "references" },
  { key: "referee2Org",  label: "Organisation / Job Title", value: "", section: "references" },
]

// Last field index per section (0-based into FIELDS array)
const SECTION_LAST_IDX: Record<SectionKey, number> = {
  "personal-info":   5,   // 0–5 (added personalStatement)
  "employment":      9,   // 6–9
  "additional-info": 17,  // 10–17
  "privacy":         18,  // 18
  "references":      22,  // 19–22
}

const SECTIONS: { key: SectionKey; label: string; sublabel?: string }[] = [
  {
    key: "personal-info",
    label: "Personal Information",
    sublabel: "Please note the process for initially completing this application can take approximately 20 minutes.",
  },
  {
    key: "employment",
    label: "Employment History",
    sublabel: "Please provide employment history for the past 10 years.",
  },
  {
    key: "additional-info",
    label: "Additional Information",
    sublabel: "THE FOLLOWING INFORMATION WILL BE USED FOR SECURITY VETTING AND REGISTRATION PURPOSES.",
  },
  {
    key: "privacy",
    label: "Data Privacy Statement (Required)",
  },
  {
    key: "references",
    label: "References",
    sublabel: "Please provide two professional referees. These fields are for you to complete — the agent has left them blank.",
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentLabel() {
  return <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Agent</p>
}

function UploadWidget({ onUpload }: { onUpload: (file: File) => void }) {
  return (
    <div className="flex justify-start w-full">
      <div className="w-full max-w-[85%]">
        <AgentLabel />
        <label className="cursor-pointer border-2 border-dashed border-[#185FA5]/30 rounded-xl p-4 flex items-center gap-3 hover:border-[#185FA5]/60 transition-colors bg-white">
          <div className="w-9 h-9 rounded-lg bg-[#185FA5]/10 flex items-center justify-center flex-shrink-0">
            <Upload size={18} className="text-[#185FA5]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700">Upload your CV</p>
            <p className="text-[11px] text-gray-400 mt-0.5">PDF or DOC · Used to match roles and pre-fill your application</p>
          </div>
          <input type="file" accept=".pdf,.doc,.docx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }} />
        </label>
      </div>
    </div>
  )
}

function JobListingCards({ onSelect }: { onSelect: (jobId: string) => void }) {
  return (
    <div className="flex justify-start w-full">
      <div className="w-full max-w-[95%] space-y-3">
        {JOBS.map((job, i) => (
          <div key={job.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900">{job.title}</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{job.department}</p>
              </div>
              <button
                onClick={() => onSelect(job.id)}
                className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#185FA5] text-white hover:bg-[#145290] transition-colors whitespace-nowrap"
              >
                Select this role
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-500 mb-3">
              <span className="flex items-center gap-1.5 truncate"><MapPin     size={10} className="text-gray-400 flex-shrink-0" />{job.location}</span>
              <span className="flex items-center gap-1.5 truncate"><DollarSign size={10} className="text-gray-400 flex-shrink-0" />{job.salary}</span>
              <span className="flex items-center gap-1.5 truncate"><Briefcase  size={10} className="text-gray-400 flex-shrink-0" />{job.experience}</span>
              <span className="flex items-center gap-1.5 truncate"><Calendar   size={10} className="text-gray-400 flex-shrink-0" />Deadline: {job.deadline}</span>
            </div>
            <div className="flex justify-end border-t border-gray-100 pt-2">
              <a
                href="https://govtcareers.gov.bm" target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-[#185FA5] hover:underline font-medium"
              >
                View more →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Inline form card — matches govtcareers.gov.bm visual style ────────────────
interface FormCardProps {
  formValues:   Record<string, string>
  filling:      Record<string, boolean>
  filled:       Record<string, boolean>
  formComplete: boolean
  sectionsDone: Set<SectionKey>
  onChange:     (key: string, value: string) => void
}

function InlineFormCard({ formValues, filling, filled, formComplete, sectionsDone, onChange }: FormCardProps) {
  // Teal label color matching govtcareers.gov.bm (#4AA3A8)
  const teal = "text-[#4AA3A8]"

  return (
    <div className="flex justify-start w-full">
      <div className="w-full">
        <AgentLabel />
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {/* Portal header */}
          <div className="bg-[#185FA5] text-white px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold opacity-80">🇧🇲 Government of Bermuda — Careers Portal</p>
                <p className="text-base font-bold mt-1">Application for <strong>MANAGER</strong></p>
                <p className="text-[11px] opacity-70 mt-0.5">Job ID: QLQFK026203F3VBQBV7V48MQG-6769</p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 transition-all duration-700 ${
                formComplete ? "bg-green-400 text-green-900" : "bg-[#FFD100] text-yellow-900"
              }`}>
                {formComplete ? "Ready to Submit" : "Agent Filling"}
              </span>
            </div>
          </div>

          {/* Sections */}
          <div className="divide-y divide-gray-100">
            {SECTIONS.map(section => {
              const isDone   = sectionsDone.has(section.key)
              const fields   = FIELDS.filter(f => f.section === section.key)

              return (
                <div key={section.key} className="px-6 py-5">
                  {/* Section heading — matches real form bold heading style */}
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-gray-900">{section.label}</h3>
                    {isDone && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={11} /> Section complete
                      </span>
                    )}
                  </div>

                  {section.sublabel && (
                    <p className={`text-xs ${section.key === "additional-info" ? "font-semibold " + teal : teal} mb-4`}>
                      {section.sublabel}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4">
                    {fields.map(f => {
                      const isFilling = !!filling[f.key]
                      const isFilled  = !!filled[f.key]
                      const inputCls = [
                        "w-full border rounded px-3 py-2 text-sm transition-all duration-200 outline-none bg-white",
                        isFilling ? "border-[#4AA3A8] ring-2 ring-[#4AA3A8]/20 bg-[#F0FAFB]" :
                        isFilled  ? "border-[#4AA3A8]/40 bg-[#F5FAFB]"                        :
                                    "border-gray-300 focus:border-[#4AA3A8] focus:ring-2 focus:ring-[#4AA3A8]/10",
                      ].join(" ")

                      return (
                        <div key={f.key} data-field={f.key} className={f.fullWidth ? "sm:col-span-2" : ""}>
                          {/* Label — teal, matches govtcareers.gov.bm exactly */}
                          <label className={`block text-sm font-medium mb-1.5 ${teal}`}>
                            {f.label}
                            {f.required && <em className={`ml-1 not-italic ${teal}`}>(Required)</em>}
                          </label>

                          {f.type === "date" ? (
                            // Date field — styled to look like Day/Month/Year but single animated input
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={formValues[f.key] ?? ""}
                                readOnly={isFilling}
                                onChange={e => onChange(f.key, e.target.value)}
                                placeholder="DD / Month / YYYY"
                                className={`${inputCls} font-mono`}
                              />
                            </div>
                          ) : f.type === "select" ? (
                            <select
                              value={formValues[f.key] ?? ""}
                              onChange={e => onChange(f.key, e.target.value)}
                              className={inputCls}
                            >
                              {(f.options ?? []).map(opt => (
                                <option key={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : f.type === "textarea" ? (
                            <div>
                              <textarea
                                value={formValues[f.key] ?? ""}
                                readOnly={isFilling}
                                rows={3}
                                onChange={e => onChange(f.key, e.target.value)}
                                className={`${inputCls} resize-none`}
                              />
                              {f.hint && (
                                <p className={`text-[11px] mt-0.5 ${teal}`}>
                                  {isFilled
                                    ? `Characters left: ${4000 - (formValues[f.key]?.length ?? 0)}`
                                    : f.hint}
                                </p>
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={formValues[f.key] ?? ""}
                              readOnly={isFilling}
                              onChange={e => onChange(f.key, e.target.value)}
                              className={inputCls}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 text-center">
              Demo mode — no application will be submitted · govtcareers.gov.bm
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SuccessCard({ submittedDate }: { submittedDate: string }) {
  return (
    <div className="flex justify-start w-full">
      <div className="w-full max-w-[90%]">
        <AgentLabel />
        <div className="bg-white border-l-4 border-green-500 rounded-r-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
            <p className="text-sm font-bold text-green-800">Application Submitted Successfully</p>
          </div>
          <div className="space-y-1.5 text-xs mb-3">
            {[
              ["Position",     "Manager (Operations)"],
              ["Department",   "Cabinet Office — Digital Innovation"],
              ["Reference ID", "BDA-2026-MGR-4471"],
              ["Submitted",    submittedDate],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-400 w-28 flex-shrink-0">{k}</span>
                <span className={`font-medium text-gray-800 ${k === "Reference ID" ? "font-mono" : ""}`}>{v}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
            A confirmation has been sent to <strong className="text-gray-700">jordan.blake@email.com</strong>.
            The hiring team will review your application and respond within 10–15 business days.
          </p>
          <p className="text-xs text-gray-600 mt-3 font-medium">Is there anything else I can help you with?</p>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProactiveAgent() {
  const [messages,        setMessages]        = useState<PreviewMessage[]>([])
  const [isTyping,        setIsTyping]        = useState(false)
  const [waitingForInput, setWaitingForInput] = useState<string | null>(null)
  const [currentChips,    setCurrentChips]    = useState<ChipOption[]>([])

  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null)

  // Form state
  const [formValues,   setFormValues]   = useState<Record<string, string>>({})
  const [filling,      setFilling]      = useState<Record<string, boolean>>({})
  const [filled,       setFilled]       = useState<Record<string, boolean>>({})
  const [formComplete, setFormComplete] = useState(false)
  // Section done tracking — drives the ✓ subtitle on each section heading
  const [sectionsDone, setSectionsDone] = useState<Set<SectionKey>>(new Set())

  const [submittedDate, setSubmittedDate] = useState("")

  const bottomRef          = useRef<HTMLDivElement>(null)
  const formRef            = useRef<HTMLDivElement>(null)
  const gateRef            = useRef<string | null>(null)
  const scenarioStartedRef = useRef(false)
  const fillCleanups       = useRef<(() => void)[]>([])
  const isFormFillingRef   = useRef(false)

  useEffect(() => () => { fillCleanups.current.forEach(fn => fn()) }, [])
  useEffect(() => {
    if (!isFormFillingRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isTyping])

  // ── Core helpers ────────────────────────────────────────────────────────────
  const addMsg       = (msg: PreviewMessage) => setMessages(prev => [...prev, msg])
  const updateAct    = (id: string, acts: PreviewActivity[]) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, activities: acts } : m))
  const markComplete = (id: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m))
  const withTyping   = async (ms: number) => { setIsTyping(true); await delay(ms); setIsTyping(false) }
  const setGate      = (gate: string, chips: ChipOption[] = []) => {
    gateRef.current = gate; setWaitingForInput(gate); setCurrentChips(chips)
  }
  const clearGate    = () => { gateRef.current = null; setWaitingForInput(null); setCurrentChips([]) }

  const markSectionDone = (key: SectionKey) =>
    setSectionsDone(prev => { const n = new Set(prev); n.add(key); return n })

  // ── Form fill orchestrator ──────────────────────────────────────────────────
  function scrollToField(key: string) {
    setTimeout(() => {
      document.querySelector(`[data-field="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 60)
  }

  function startFormFill() {
    isFormFillingRef.current = true
    let idx = 0

    function fillOne() {
      if (idx >= FIELDS.length) {
        isFormFillingRef.current = false
        setFormComplete(true)
        schedulePostFillMessages()
        return
      }
      const field = FIELDS[idx]

      // References fields are left for the user — agent skips them
      if (!field.value) {
        idx++
        const ts = setTimeout(fillOne, 50)
        fillCleanups.current.push(() => clearTimeout(ts))
        return
      }

      if (field.type === "select") {
        setFilling(prev => ({ ...prev, [field.key]: true }))
        scrollToField(field.key)
        const t = setTimeout(() => {
          setFormValues(prev => ({ ...prev, [field.key]: field.value }))
          setFilling(prev => ({ ...prev, [field.key]: false }))
          setFilled(prev => ({ ...prev, [field.key]: true }))
          // Check section completion
          const sectionLastIdx = SECTION_LAST_IDX[field.section]
          if (idx === sectionLastIdx) markSectionDone(field.section)
          if (idx === FIELDS.length - 1) {
            setFormComplete(true)
            schedulePostFillMessages()
          } else {
            idx++
            const t2 = setTimeout(fillOne, 400)
            fillCleanups.current.push(() => clearTimeout(t2))
          }
        }, 700)
        fillCleanups.current.push(() => clearTimeout(t))
        return
      }

      // Text / textarea / date: character typewriter
      const charMs = field.type === "textarea" ? 8 : field.type === "date" ? 30 : 20
      setFilling(prev => ({ ...prev, [field.key]: true }))
      scrollToField(field.key)
      let charIdx = 0
      const iid = setInterval(() => {
        charIdx++
        setFormValues(prev => ({ ...prev, [field.key]: field.value.slice(0, charIdx) }))
        if (charIdx >= field.value.length) {
          clearInterval(iid)
          setFilling(prev => ({ ...prev, [field.key]: false }))
          setFilled(prev => ({ ...prev, [field.key]: true }))
          // Check section completion
          const sectionLastIdx = SECTION_LAST_IDX[field.section]
          if (idx === sectionLastIdx) markSectionDone(field.section)
          if (idx === FIELDS.length - 1) {
            setFormComplete(true)
            schedulePostFillMessages()
          } else {
            idx++
            const t = setTimeout(fillOne, 300)
            fillCleanups.current.push(() => clearTimeout(t))
          }
        }
      }, charMs)
      fillCleanups.current.push(() => clearInterval(iid))
    }

    const t = setTimeout(fillOne, 600)
    fillCleanups.current.push(() => clearTimeout(t))
  }

  function schedulePostFillMessages() {
    const t = setTimeout(() => {
      addMsg({
        id: uid("ms"), type: "assistant",
        content: "All done — the form is fully filled and ready for your review. You can edit any field before submitting.",
      })
      const t2 = setTimeout(() => {
        addMsg({
          id: uid("confirm"), type: "confirmation",
          content: "Your application is complete. Please review the form above and confirm you're ready to submit to the Government of Bermuda Careers Portal.",
          confirmOptions: [
            { label: "Edit a field",     value: "edit-form"                  },
            { label: "Confirm & Submit", value: "submit-form", primary: true },
          ],
        })
        setGate("submit-gate", [
          { label: "Edit a field",     value: "edit-form"                  },
          { label: "Confirm & Submit", value: "submit-form", primary: true },
        ])
      }, 800)
      fillCleanups.current.push(() => clearTimeout(t2))
    }, 600)
    fillCleanups.current.push(() => clearTimeout(t))
  }

  // ── Step 3 — CV processing ─────────────────────────────────────────────────
  async function runCVProcessing(filename: string) {
    const actId = uid("act1")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "p1", label: `📄 Reading ${filename}…`,                              status: "running" },
        { id: "p2", label: "🔍 Searching govtcareers.gov.bm for open positions…",  status: "waiting" },
        { id: "p3", label: "⚡ Matching roles to your profile…",                   status: "waiting" },
      ],
    })

    await delay(1800)
    updateAct(actId, [
      { id: "p1", label: "CV parsed ✓",                           status: "done",    detail: "Jordan Blake · 6 years experience · Operations Management" },
      { id: "p2", label: "Searching govtcareers.gov.bm…",         status: "running" },
      { id: "p3", label: "Matching roles to profile…",            status: "waiting" },
    ])

    await delay(1600)
    updateAct(actId, [
      { id: "p1", label: "CV parsed ✓",                           status: "done" },
      { id: "p2", label: "Found 4 matching positions ✓",          status: "done",    detail: "Manager (Ops) · Senior Programme Manager · Strategy & Performance · Project Manager" },
      { id: "p3", label: "Matching roles to profile…",            status: "running" },
    ])

    await delay(1200)
    updateAct(actId, [
      { id: "p1", label: "CV parsed ✓",                           status: "done" },
      { id: "p2", label: "Found 4 matching positions ✓",          status: "done" },
      { id: "p3", label: "Best match: Manager (Operations) ✓",    status: "done",    detail: "95% match · Cabinet Office · BMD $85k–$105k" },
    ])
    markComplete(actId)

    await delay(700)
    await withTyping(1400)
    addMsg({
      id: uid(), type: "assistant",
      content: "I found 4 open positions that match your background. Here are the most relevant roles currently listed on the Government of Bermuda careers portal:",
    })
    addMsg({ id: uid("jobs"), type: "job-cards" as any } as PreviewMessage)
  }

  // ── Step 5 — Form opening ──────────────────────────────────────────────────
  async function runFormOpening() {
    const actId = uid("act2")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "f1", label: "🌐 Opening application on govtcareers.gov.bm…",  status: "running" },
        { id: "f2", label: "📋 Loading form fields…",                         status: "waiting" },
        { id: "f3", label: "✍️ Pre-filling with your CV details…",           status: "waiting" },
      ],
    })

    await delay(1500)
    updateAct(actId, [
      { id: "f1", label: "Application form opened ✓",             status: "done",    detail: "govtcareers.gov.bm · Manager (Operations) · Job ID QLQFK026203F3VBQBV7V48MQG-6769" },
      { id: "f2", label: "Loading form fields…",                  status: "running" },
      { id: "f3", label: "Pre-filling with CV details…",          status: "waiting" },
    ])

    await delay(1200)
    updateAct(actId, [
      { id: "f1", label: "Application form opened ✓",             status: "done" },
      { id: "f2", label: "Form fields loaded ✓",                  status: "done",    detail: "5 sections — Personal Info, Employment History, Additional Info, Privacy, References" },
      { id: "f3", label: "Pre-filling with CV details…",          status: "running", detail: "Extracting name, dates, qualifications, employment history…" },
    ])

    await delay(1400)
    updateAct(actId, [
      { id: "f1", label: "Application form opened ✓",             status: "done" },
      { id: "f2", label: "Form fields loaded ✓",                  status: "done" },
      { id: "f3", label: "Form ready — filling now ✓",            status: "done",    detail: "23 fields across 5 sections · starting typewriter fill" },
    ])
    markComplete(actId)

    await delay(600)
    await withTyping(1200)
    addMsg({
      id: uid(), type: "assistant",
      content: "I've opened the official application form for **Manager (Operations)**. Watch as I fill it in — you can edit any field at any time. Each section will be marked complete as I go.",
    })

    addMsg({ id: uid("form"), type: "form-placeholder" as any } as PreviewMessage)
    startFormFill()
  }

  // ── Step 8 — Submission ────────────────────────────────────────────────────
  async function runSubmission() {
    const actId = uid("act3")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "s1", label: "📤 Submitting to govtcareers.gov.bm…",                status: "running" },
        { id: "s2", label: "✓ Application received by Government of Bermuda",     status: "waiting" },
      ],
    })

    await delay(2200)
    updateAct(actId, [
      { id: "s1", label: "Submitted to govtcareers.gov.bm ✓",                   status: "done",    detail: "Job ID: QLQFK026203F3VBQBV7V48MQG-6769 · timestamp confirmed" },
      { id: "s2", label: "Application received by Government of Bermuda ✓",     status: "done",    detail: "Confirmation sent to marcus.tavares@email.com" },
    ])
    markComplete(actId)

    const now  = new Date()
    const date = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    setSubmittedDate(date)

    await delay(700)
    addMsg({ id: uid("success"), type: "success-card" as any } as PreviewMessage)

    await delay(600)
    setGate("done", [
      { label: "Apply for another role", value: "apply-again", primary: true },
    ])
  }

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (scenarioStartedRef.current) return
      scenarioStartedRef.current = true
      const hour = new Date().getHours()
      const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
      addMsg({
        id: "intro", type: "assistant",
        content: `${greeting}, Jordan! 👋 Great to have you here. I'm your Citizen Agent — I can help you apply for Government of Bermuda positions, check your work permit, or navigate any government service. What would you like to get done today?`,
      })
      setGate("start", [
        { label: "I want to apply for a government job",  value: "apply",  primary: true },
        { label: "Help me check my work permit status",   value: "permit" },
      ])
    }, 80)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Job selection ──────────────────────────────────────────────────────────
  async function handleSelectJob(_jobId: string) {
    addMsg({ id: uid("u"), type: "user", content: "Select this role — Manager (Operations)" })
    await withTyping(800)
    addMsg({
      id: uid(), type: "assistant",
      content: "Great choice — the Manager (Operations) role at the Cabinet Office is a strong match for your profile. Let me open the official application form now.",
    })
    await runFormOpening()
  }

  // ── File upload ────────────────────────────────────────────────────────────
  async function handleUpload(file: File) {
    setUploadedFilename(file.name)
    addMsg({ id: uid("u"), type: "user", content: `📄 ${file.name}` })
    await runCVProcessing(file.name)
  }

  // ── Chip dispatcher ────────────────────────────────────────────────────────
  async function handleChipAction(value: string) {
    const gate = gateRef.current
    clearGate()

    if (gate === "start") {
      if (value === "apply") {
        addMsg({ id: uid("u"), type: "user", content: "I want to apply for a government job" })
        await withTyping(1000)
        addMsg({
          id: uid(), type: "assistant",
          content: "I can help you apply for a Government of Bermuda position. To find the most relevant roles for you, please upload your CV and I'll match you with open positions.",
        })
        addMsg({ id: uid("upload"), type: "upload-card" as any } as PreviewMessage)
      } else {
        addMsg({ id: uid("u"), type: "user", content: "Help me check my work permit status" })
        await withTyping(900)
        addMsg({
          id: uid(), type: "assistant",
          content: "In a full deployment, I'd check your work permit status directly from the Department of Immigration database. This demo focuses on the job application journey — use the chip below to see it in action.",
        })
        setGate("start", [
          { label: "I want to apply for a government job", value: "apply", primary: true },
        ])
      }
      return
    }

    if (gate === "submit-gate") {
      if (value === "edit-form") {
        addMsg({ id: uid("u"), type: "user", content: "Edit a field" })
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        await delay(1000)
        addMsg({
          id: uid(), type: "assistant",
          content: "The form is fully editable — click any field to make changes. When you're happy with everything, use the Confirm & Submit button below.",
        })
        setGate("submit-gate", [
          { label: "Edit a field",     value: "edit-form"                   },
          { label: "Confirm & Submit", value: "submit-form", primary: true  },
        ])
      } else if (value === "submit-form") {
        addMsg({ id: uid("u"), type: "user", content: "Confirm & Submit" })
        await runSubmission()
      }
      return
    }

    if (gate === "done") {
      if (value === "apply-again") {
        addMsg({ id: uid("u"), type: "user", content: "Apply for another role" })
        await withTyping(700)
        addMsg({
          id: uid(), type: "assistant",
          content: "Happy to help with another application. Please upload your CV again and I'll find the best matches for you.",
        })
        setUploadedFilename(null)
        addMsg({ id: uid("upload2"), type: "upload-card" as any } as PreviewMessage)
      }
      return
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Context pills */}
      <div className="bg-white px-4 pt-3 pb-2 flex gap-2 flex-wrap flex-shrink-0 border-b border-gray-100">
        {["🇧🇲  Bermuda", "Standard Work Permit", "Jordan Blake"].map(pill => (
          <span key={pill} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1 rounded-full font-medium">
            {pill}
          </span>
        ))}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{
          backgroundColor: "#F9FAFB",
          backgroundImage: "radial-gradient(circle, rgba(255,196,0,0.15) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {messages.map(msg => (
          <Fragment key={msg.id}>
            {(msg as any).type === "upload-card" ? (
              uploadedFilename ? null : <UploadWidget onUpload={handleUpload} />
            ) : (msg as any).type === "job-cards" ? (
              <JobListingCards onSelect={handleSelectJob} />
            ) : (msg as any).type === "form-placeholder" ? (
              <div ref={formRef}>
                <InlineFormCard
                  formValues={formValues}
                  filling={filling}
                  filled={filled}
                  formComplete={formComplete}
                  sectionsDone={sectionsDone}
                  onChange={(key, val) => setFormValues(prev => ({ ...prev, [key]: val }))}
                />
              </div>
            ) : (msg as any).type === "success-card" ? (
              <SuccessCard submittedDate={submittedDate} />
            ) : (
              <PreviewMessageRenderer message={msg} onAction={handleChipAction} />
            )}
          </Fragment>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="max-w-[85%]">
              <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Agent</p>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Chip gate */}
      {waitingForInput && currentChips.length > 0 && (
        <div className="bg-white border-t border-gray-100 px-4 py-2.5 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {currentChips.map(chip => (
              <button key={chip.value} onClick={() => handleChipAction(chip.value)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  chip.primary
                    ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-500"
                    : "border border-gray-300 bg-white text-gray-600 hover:border-yellow-400 hover:bg-yellow-50"
                }`}>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Disabled input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 select-none">
            Citizen Agent is handling this step…
          </div>
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center opacity-40">
            <Send size={14} className="text-gray-500" />
          </div>
        </div>
      </div>
    </div>
  )
}
