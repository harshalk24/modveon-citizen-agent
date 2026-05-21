import Link from "next/link"
import { Sparkles, Baby, ArrowRight } from "lucide-react"

export default function PreviewEntryPage() {
  return (
    <div className="min-h-[calc(100vh-36px)] flex flex-col items-center justify-center px-4 py-12">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-yellow-400 flex items-center justify-center mx-auto mb-4 shadow-md shadow-yellow-200">
          <Sparkles size={24} className="text-yellow-900" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Citizen Assist — Proactive Agent</h1>
        <p className="text-gray-500 mt-1 text-sm">See how the agent works on your behalf</p>
      </div>

      {/* Scenario card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-yellow-50 border-b border-yellow-100 px-5 py-4 flex items-center gap-3">
          <div className="text-2xl">🍼</div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">María's story</p>
            <p className="text-xs text-gray-500 mt-0.5">New baby · El Salvador · Employed</p>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            The agent finds 5 benefits, fills the RNPN registration form, submits it, and follows up with a WhatsApp reminder — all proactively.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["RNPN registration","Maternity benefit","ISSS enrollment","Child subsidy","Paternity benefit"].map(b => (
              <span key={b} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{b}</span>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5">
          <Link
            href="/preview/chat"
            className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            Start scenario <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-6 max-w-xs">
        All data in this demo is fictional.<br />
        The live product requires real information.
      </p>
    </div>
  )
}
