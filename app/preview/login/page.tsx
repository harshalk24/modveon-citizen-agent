"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Loader2, Eye, EyeOff, Shield, Fingerprint } from "lucide-react"

export default function PreviewLoginPage() {
  const router = useRouter()
  const [dui, setDui] = useState("12345678-9")
  const [password, setPassword] = useState("••••••••")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleVerify = () => {
    if (!dui.trim() || loading) return
    setLoading(true)
    setTimeout(() => router.push("/preview/chat"), 2000)
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4 py-12 overflow-hidden">

      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-[#070E1F]" />

      {/* Decorative blobs */}
      <div className="absolute -top-40 -right-20 w-[500px] h-[500px] rounded-full bg-[#0EA5E9]/20 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 -left-32   w-[400px] h-[400px] rounded-full bg-[#0284C7]/30 blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-20 right-1/3 w-[350px] h-[350px] rounded-full bg-[#0EA5E9]/12 blur-[90px] pointer-events-none" />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.8) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Wordmark */}
      <div className="relative text-center mb-8 z-10">
        <div className="flex items-center justify-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-xl bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/30">
            <MessageSquare size={17} className="text-yellow-900" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Citizen Assist</span>
        </div>
        <p className="text-xs text-white/40">El Salvador · Powered by Modveon</p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">

        {/* Step indicator */}
        <div className="flex border-b border-gray-100">
          <div className="flex-1 flex items-center justify-center gap-2 py-3 border-r border-gray-100 bg-yellow-50">
            <span className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center text-[10px] font-bold text-yellow-900">1</span>
            <span className="text-xs font-semibold text-yellow-900">Verify identity</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 py-3">
            <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">2</span>
            <span className="text-xs font-medium text-gray-400">Your benefits</span>
          </div>
        </div>

        <div className="px-6 py-5">
          <h2 className="text-base font-bold text-gray-900 mb-1">Identify yourself</h2>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">
            Enter your DUI number and password to securely access your government records and benefits.
          </p>

          {/* DUI input */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">DUI Number</label>
            <input
              type="text"
              value={dui}
              onChange={e => setDui(e.target.value)}
              placeholder="12345678-9"
              maxLength={11}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-sky-50"
            />
            <p className="text-[11px] text-gray-400 mt-1">Format: 8 digits, dash, 1 digit</p>
          </div>

          {/* Password input */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm pr-10 focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-sky-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Biometric — disabled */}
          <div className="opacity-40 cursor-not-allowed border border-dashed border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-5">
            <Fingerprint size={18} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-600">Scan passport chip (NFC)</p>
              <p className="text-[11px] text-gray-400">Coming soon — instant verification</p>
            </div>
          </div>

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={loading || !dui.trim()}
            className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Verifying identity...
              </>
            ) : (
              "Verify identity →"
            )}
          </button>

          <div className="mt-4 space-y-1 text-center">
            <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
              <Shield size={11} />
              Secured by RNPN identity registry
            </p>
            <p className="text-[10px] text-gray-300">This is a preview — no real data is accessed</p>
          </div>
        </div>
      </div>
    </div>
  )
}
