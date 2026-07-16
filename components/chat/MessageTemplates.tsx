"use client"

import { useEffect, useState } from "react"

export type ConversationState = "empty" | "results-shown" | "plan-shown" | "document-question" | "meta"

const TEMPLATES = {
  en: {
    "empty": [
      "I just had a baby",
      "I lost my job",
      "I want to register my business",
      "I need a poder from the US",
    ],
    "meta": [
      "See my benefits",
      "Show my plan",
      "What else can I apply for?",
      "What can you do?",
    ],
    "results-shown": [
      "What documents do I need?",
      "Which one is most urgent?",
      "Show me the action plan",
      "What happens if I miss the deadline?",
    ],
    "plan-shown": [
      "I don't understand step 1",
      "How long will this take?",
      "What if I don't have my DUI?",
      "Can I do any of these online?",
    ],
    "document-question": [
      "Where do I get this document?",
      "How much does it cost?",
      "How long does it take?",
      "Can someone else pick it up for me?",
    ],
  },
  es: {
    "empty": [
      "Acabo de tener un bebé",
      "Me quedé sin trabajo",
      "Quiero registrar mi negocio",
      "Necesito un poder desde EEUU",
    ],
    "meta": [
      "Ver mis beneficios",
      "Mostrá mi plan",
      "¿Qué más puedo solicitar?",
      "¿Qué podés hacer?",
    ],
    "results-shown": [
      "¿Qué documentos necesito?",
      "¿Cuál es el más urgente?",
      "Mostrá mi plan de acción",
      "¿Qué pasa si me paso del plazo?",
    ],
    "plan-shown": [
      "No entiendo el paso 1",
      "¿Cuánto tiempo lleva esto?",
      "¿Qué hago si no tengo DUI?",
      "¿Puedo hacer algo de esto en línea?",
    ],
    "document-question": [
      "¿Dónde consigo este documento?",
      "¿Cuánto cuesta?",
      "¿Cuánto tarda?",
      "¿Puede retirarlo otra persona?",
    ],
  },
}

interface Props {
  conversationState?: ConversationState
  language?: "en" | "es"
  onSelect: (message: string) => void
  disabled?: boolean
}

export default function MessageTemplates({
  conversationState = "empty",
  language = "es",
  onSelect,
  disabled,
}: Props) {
  const [visible, setVisible] = useState(true)
  const [displayed, setDisplayed] = useState<ConversationState>(conversationState)

  // Fade out → swap templates → fade in when state changes
  useEffect(() => {
    if (conversationState === displayed) return
    setVisible(false)
    const t = setTimeout(() => {
      setDisplayed(conversationState)
      setVisible(true)
    }, 180)
    return () => clearTimeout(t)
  }, [conversationState])

  const lang = language === "en" ? "en" : "es"
  const chips = TEMPLATES[lang][displayed] ?? []
  if (!chips.length) return null

  return (
    <div
      className="flex flex-wrap gap-2 px-[34px] py-3 transition-opacity duration-150"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {chips.map((chip, i) => (
        <button
          key={`${displayed}-${lang}-${i}`}
          onClick={() => onSelect(chip)}
          disabled={disabled}
          className="text-[12.5px] font-medium px-3.5 py-2 rounded-full border border-ca-surface-input bg-white
                     hover:border-ca-yellow text-[#475569]
                     transition-all disabled:opacity-40 whitespace-nowrap"
        >
          {chip}
        </button>
      ))}
    </div>
  )
}
