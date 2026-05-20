"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { CitizenContextData } from "@/types/context"

interface CitizenCtx {
  citizen: CitizenContextData | null
  setCitizen: (c: CitizenContextData | null) => void
  sessionId: string
  isLoading: boolean
  // Returns the fresh data so callers can use it immediately
  // without waiting for the React state update cycle
  refresh: () => Promise<CitizenContextData | null>
}

const CitizenCtxDefault: CitizenCtx = {
  citizen: null,
  setCitizen: () => {},
  sessionId: "",
  isLoading: true,
  refresh: async () => null,
}

const CitizenContext = createContext<CitizenCtx>(CitizenCtxDefault)

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function CitizenProvider({ children }: { children: ReactNode }) {
  const [citizen, setCitizen] = useState<CitizenContextData | null>(null)
  const [sessionId, setSessionId] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  /** Read citizenId from localStorage, falling back to the cookie set at onboarding. */
  const getCitizenId = (): string | null => {
    if (typeof window === "undefined") return null
    const fromLS = localStorage.getItem("ca_citizen_id")
    if (fromLS) return fromLS
    // Cookie fallback — handles private-browsing / localStorage wipe scenarios
    const match = document.cookie.match(/(?:^|;\s*)ca_citizen_id=([^;]+)/)
    const fromCookie = match ? match[1] : null
    if (fromCookie) {
      // Restore to localStorage so future reads are instant
      localStorage.setItem("ca_citizen_id", fromCookie)
    }
    return fromCookie
  }

  const refresh = async (): Promise<CitizenContextData | null> => {
    const citizenId = getCitizenId()
    if (!citizenId) { setIsLoading(false); return null }
    try {
      const res = await fetch("/api/citizen/me", {
        headers: { "x-citizen-id": citizenId }
      })
      if (res.ok) {
        const data: CitizenContextData = await res.json()
        setCitizen(data)
        return data          // ← return fresh data so callers can use it immediately
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
    return null
  }

  useEffect(() => {
    let sid = localStorage.getItem("ca_session_id")
    if (!sid) {
      sid = generateSessionId()
      localStorage.setItem("ca_session_id", sid)
    }
    setSessionId(sid)
    refresh()
  }, [])

  return (
    <CitizenContext.Provider value={{ citizen, setCitizen, sessionId, isLoading, refresh }}>
      {children}
    </CitizenContext.Provider>
  )
}

export const useCitizen = () => useContext(CitizenContext)
