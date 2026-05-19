"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowRight } from "lucide-react"
import { useLang } from "@/contexts/LanguageContext"

interface TourStep {
  targetSelector: string
  titleEn: string
  titleEs: string
  bodyEn: string
  bodyEs: string
  position: "bottom" | "top" | "left" | "right"
}

const STEPS: TourStep[] = [
  {
    targetSelector: "[data-tour='context-pills']",
    titleEn: "Your situation",
    titleEs: "Tu situación",
    bodyEn: "These pills show what we know about you. Tap your profile to update anytime.",
    bodyEs: "Estas etiquetas muestran tu situación. Actualizalas en tu perfil cuando quieras.",
    position: "bottom",
  },
  {
    targetSelector: "[data-tour='agent-message']",
    titleEn: "Your benefits",
    titleEs: "Tus beneficios",
    bodyEn: "I proactively show every benefit you qualify for — you don't need to ask.",
    bodyEs: "Muestro todos los beneficios que te corresponden — no necesitás preguntar.",
    position: "bottom",
  },
  {
    targetSelector: "[data-tour='templates']",
    titleEn: "Quick shortcuts",
    titleEs: "Atajos rápidos",
    bodyEn: "Tap any chip to instantly ask a common question without typing.",
    bodyEs: "Tocá cualquier etiqueta para hacer una pregunta común sin escribir.",
    position: "top",
  },
  {
    targetSelector: "[data-tour='input-bar']",
    titleEn: "Ask me anything",
    titleEs: "Preguntame lo que quieras",
    bodyEn: "Type your question here. I'll give you a straight answer — no bureaucratic runaround.",
    bodyEs: "Escribí tu pregunta acá. Te doy una respuesta directa — sin burocracia.",
    position: "top",
  },
]

export default function ChatTour({ onDone }: { onDone: () => void }) {
  const { lang } = useLang()
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  const current = STEPS[step]
  const isEs = lang === "es"

  useEffect(() => {
    measureTarget()
    window.addEventListener("resize", measureTarget)
    return () => window.removeEventListener("resize", measureTarget)
  }, [step])

  const measureTarget = () => {
    const el = document.querySelector(current.targetSelector) as HTMLElement | null
    if (!el) { setPos(null); return }
    const r = el.getBoundingClientRect()
    setPos({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height })
  }

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else onDone()
  }

  const tooltipTop = () => {
    if (!pos) return 0
    if (current.position === "bottom") return pos.top + pos.height + 12
    if (current.position === "top") return pos.top - 130
    return pos.top
  }

  const tooltipLeft = () => {
    if (!pos) return 0
    const center = pos.left + pos.width / 2
    return Math.max(12, Math.min(center - 160, window.innerWidth - 344))
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Dark overlay with hole */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onDone} />

      {/* Highlight cutout */}
      {pos && (
        <div
          className="absolute rounded-xl ring-2 ring-[#185FA5] ring-offset-2 bg-transparent pointer-events-none"
          style={{
            top: pos.top - 4,
            left: pos.left - 4,
            width: pos.width + 8,
            height: pos.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="absolute w-80 bg-white rounded-2xl shadow-2xl p-4 pointer-events-auto"
          style={{ top: tooltipTop(), left: tooltipLeft() }}
        >
          {/* Step dots */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-4 bg-[#185FA5]" : i < step ? "w-1.5 bg-blue-300" : "w-1.5 bg-gray-200"}`} />
              ))}
            </div>
            <button onClick={onDone} className="text-gray-400 hover:text-gray-600 transition-colors p-0.5">
              <X size={14} />
            </button>
          </div>

          <p className="text-sm font-bold text-gray-900 mb-1">
            {isEs ? current.titleEs : current.titleEn}
          </p>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            {isEs ? current.bodyEs : current.bodyEn}
          </p>

          <div className="flex items-center justify-between">
            <button onClick={onDone} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              {isEs ? "Omitir tour" : "Skip tour"}
            </button>
            <button
              onClick={next}
              className="flex items-center gap-1.5 bg-[#185FA5] hover:bg-[#145290] text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
            >
              {step === STEPS.length - 1
                ? (isEs ? "¡Listo!" : "Got it!")
                : (isEs ? "Siguiente" : "Next")}
              <ArrowRight size={12} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
