"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Lang } from "@/lib/i18n"
import { useConversations } from "@/contexts/ConversationsContext"

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

// Task I18N_PER_CONVERSATION (Part 2) — "is a conversation open right now,
// and if so, what's its fixed language." Scoped to /chat specifically:
// activeConversationId persists across page navigation (it's really "which
// conversation the next chat message appends to," a cross-page concept), so
// checking it alone would also lock the toggle on Dashboard/Profile just
// because a conversation exists somewhere — the task is explicit that those
// pages (plus a fresh/empty chat) must keep the toggle active. "Open" means
// viewing /chat with a real thread loaded, which is exactly pathname==='/chat'
// AND activeConversationId !== null.
//
// A single hook backs both the toggle-lock (Sidebar) and the chrome-language
// (Sidebar + the chat page itself) so the two can never disagree.
export function useChromeLanguage(): { lang: Lang; locked: boolean } {
  const { lang } = useContext(LanguageContext)
  const { activeConversationId, activeConversationLanguage } = useConversations()
  const pathname = usePathname()
  const locked = pathname === "/chat" && activeConversationId !== null && activeConversationLanguage !== null
  return { lang: locked ? activeConversationLanguage! : lang, locked }
}
