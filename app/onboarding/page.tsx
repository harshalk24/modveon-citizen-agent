"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Onboarding is now handled conversationally inside the chat window.
 * This page simply redirects to /chat where the onboarding flow begins
 * automatically when no citizenId is present in localStorage.
 */
export default function OnboardingPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/chat")
  }, [router])
  return null
}
