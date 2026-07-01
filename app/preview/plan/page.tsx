"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react"

interface Step {
  id:       string
  title:    string
  agency:   string
  mode:     "online" | "in-person" | "auto"
  cost:     string
  duration: string
  link?:    string
  tip:      string
  urgent?:  boolean
}
interface Phase {
  phase:  number
  label:  string
  timing: string
  color:  string
  steps:  Step[]
}

const UK_PLAN: Phase[] = [
  {
    phase: 1, label: "Register your food business", timing: "Today — 28-day processing window starts now",
    color: "border-red-400",
    steps: [
      { id: "food-reg", title: "Food business registration", agency: "Local council (via food.gov.uk)", mode: "online", cost: "Free", duration: "5 min to register · 28 days to process", link: "https://www.food.gov.uk/business-guidance/register-a-food-business", urgent: true, tip: "Must be done at least 28 days before you start trading. Do this today. You'll need: business name, premises address, type of food you'll sell." },
    ],
  },
  {
    phase: 2, label: "Set up your legal structure", timing: "This week",
    color: "border-blue-400",
    steps: [
      { id: "sole-trader", title: "Register as sole trader with HMRC", agency: "HMRC", mode: "online", cost: "Free", duration: "10 min", link: "https://www.gov.uk/set-up-sole-trader", tip: "Simplest structure for a first business. No Companies House filing needed. You pay income tax on profits through Self Assessment." },
      { id: "self-assess", title: "Register for Self Assessment", agency: "HMRC", mode: "online", cost: "Free", duration: "10 min", link: "https://www.gov.uk/register-for-self-assessment", tip: "Required from your first year trading. Register by 5 October following your first year in business. Do it now to avoid forgetting." },
    ],
  },
  {
    phase: 3, label: "Get your food hygiene in order", timing: "Week 2",
    color: "border-yellow-400",
    steps: [
      { id: "hygiene-cert", title: "Level 2 Food Hygiene Certificate", agency: "High Speed Training / Highfield", mode: "online", cost: "£25–30", duration: "2–3 hours online · instant certificate", link: "https://www.highspeedtraining.co.uk/food-hygiene", tip: "Legally required for anyone handling food. Online course you can complete in one afternoon. Certificate valid for 3 years." },
      { id: "haccp", title: "Set up food safety management (HACCP)", agency: "Food Standards Agency", mode: "online", cost: "Free", duration: "1–2 hours", link: "https://www.food.gov.uk/business-guidance/safer-food-better-business", tip: "Download the FSA's free 'Safer Food, Better Business' pack. You need to show this during a council inspection — it's simpler than it sounds." },
    ],
  },
  {
    phase: 4, label: "Sort operations before opening", timing: "Week 3–4",
    color: "border-emerald-400",
    steps: [
      { id: "insurance", title: "Public liability insurance", agency: "Simply Business / Direct Line", mode: "online", cost: "£500–2,000/year", duration: "20 min online", link: "https://www.simplybusiness.co.uk", tip: "Required if customers enter your premises. Use a comparison site — Simply Business is good for small food businesses. Get quotes from 3+ providers." },
      { id: "bank", title: "Open a business bank account", agency: "Starling / Monzo Business", mode: "online", cost: "Free (basic account)", duration: "15 min online", link: "https://www.starlingbank.com/business-account", tip: "Starling Bank and Monzo Business are free and open entirely online via app — no branch visits. Keeps your business and personal finances separate (HMRC recommendation)." },
    ],
  },
]

const MODE_LABEL: Record<Step["mode"], { label: string; color: string }> = {
  "online":    { label: "🌐 Online",    color: "bg-blue-50 text-blue-700 border-blue-200"    },
  "in-person": { label: "📍 In-person", color: "bg-amber-50 text-amber-700 border-amber-200" },
  "auto":      { label: "🔄 Auto",      color: "bg-gray-50 text-gray-500 border-gray-200"    },
}

export default function PreviewPlanPage() {
  const [done,     setDone]     = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1, 2]))

  const allSteps  = UK_PLAN.flatMap(p => p.steps)
  const doneCount = allSteps.filter(s => done.has(s.id)).length
  const progress  = Math.round((doneCount / allSteps.length) * 100)

  const toggleDone  = (id: string) =>
    setDone(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const togglePhase = (p: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n })

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Link href="/preview/navigation" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                  <ArrowLeft size={12} /> Back to chat
                </Link>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Opening a Food Business in London</h1>
              <p className="text-sm text-gray-500 mt-0.5">Bubble tea café · UK legal requirements · Correct sequence</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {doneCount} of {allSteps.length} steps done
            </span>
          </div>
          <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#185FA5] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-3xl mx-auto">
        {UK_PLAN.map(phase => {
          const isOpen    = expanded.has(phase.phase)
          const phaseDone = phase.steps.filter(s => done.has(s.id)).length
          return (
            <div key={phase.phase} className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden border-l-4 ${phase.color}`}>
              <button onClick={() => togglePhase(phase.phase)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phase {phase.phase}</span>
                  <span className="text-sm font-semibold text-gray-800">{phase.label}</span>
                  {phaseDone > 0 && <span className="text-xs text-emerald-600 font-medium">{phaseDone}/{phase.steps.length} done</span>}
                </div>
                <div className="flex items-center gap-3">
                  {phase.steps.some(s => s.urgent) && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">DO TODAY</span>}
                  {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </button>
              {isOpen && (
                <div className="divide-y divide-gray-50">
                  {phase.steps.map(step => {
                    const isDone = done.has(step.id)
                    const ml     = MODE_LABEL[step.mode]
                    return (
                      <div key={step.id} className={`p-4 ${isDone ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {step.urgent && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex-shrink-0">⚠️ DO TODAY</span>}
                            <span className={`text-sm font-semibold ${isDone ? "line-through text-gray-400" : "text-gray-800"}`}>{step.title}</span>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${ml.color}`}>{ml.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mb-2 flex-wrap">
                          <span>{step.agency}</span>
                          <span>·</span>
                          <span>Cost: <strong className="text-gray-600">{step.cost}</strong></span>
                          <span>·</span>
                          <span>Time: <strong className="text-gray-600">{step.duration}</strong></span>
                          {step.link && (<><span>·</span><a href={step.link} target="_blank" rel="noopener noreferrer" className="text-[#185FA5] font-medium hover:underline">{step.link.replace("https://www.", "").replace("https://", "").split("/")[0]}</a></>)}
                        </div>
                        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 mb-3 leading-relaxed">💡 {step.tip}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {step.link && (<a href={step.link} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded-lg bg-[#FFC400] text-yellow-900 hover:bg-[#E5AF00] transition-colors font-semibold">Apply now →</a>)}
                            <Link href="/preview/navigation" className="text-xs text-gray-400 hover:text-[#185FA5] transition-colors">Ask agent</Link>
                          </div>
                          {isDone ? (
                            <button onClick={() => toggleDone(step.id)} className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors"><CheckCircle2 size={12} />Done ✓</button>
                          ) : (
                            <button onClick={() => toggleDone(step.id)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#185FA5] text-white hover:bg-[#145290] transition-colors"><CheckCircle2 size={11} />Mark as done</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
