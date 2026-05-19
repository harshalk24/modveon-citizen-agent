"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { Lang } from "@/lib/i18n"

interface LanguageContextType {
  lang: Lang
  setLang: (l: Lang) => void
  toggle: () => void
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  toggle: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")

  useEffect(() => {
    const stored = localStorage.getItem("ca_lang") as Lang | null
    if (stored === "en" || stored === "es") setLangState(stored)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem("ca_lang", l)
  }

  const toggle = () => setLang(lang === "en" ? "es" : "en")

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLang = () => useContext(LanguageContext)
