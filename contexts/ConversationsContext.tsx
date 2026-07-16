"use client"

// Task History-C2 — shared client state so Sidebar (the conversation list)
// and the chat page (the message view) can coordinate without prop-drilling
// or a parent/child relationship — they're siblings under app/layout.tsx,
// same pattern CitizenContext already established for citizen/sessionId.
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useCitizen } from "@/contexts/CitizenContext"

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
}

export interface ConversationMessage {
  id: string
  role: string
  content: string
  createdAt: string
}

interface ConversationsCtx {
  conversations: ConversationSummary[]
  activeConversationId: string | null
  // Set once a conversation's messages have been fetched for the current
  // activeConversationId (non-empty array), or reset to an EMPTY array as
  // the "start fresh" signal from startNewConversation/removeConversation —
  // a real persisted conversation always has >=2 messages (commit 1: a
  // Conversation exists only once it has a first message), so an empty
  // array is unambiguous as the reset sentinel. null = nothing pending; the
  // chat page consumes it once via clearPendingMessages.
  pendingMessages: ConversationMessage[] | null
  clearPendingMessages: () => void
  refreshConversations: () => Promise<void>
  selectConversation: (id: string) => Promise<void>
  startNewConversation: () => Promise<void>
  removeConversation: (id: string) => Promise<void>
  // Syncs activeConversationId to whatever the server actually used for a
  // turn (the X-Conversation-Id chat response header) — NOT just set by
  // selectConversation. Without this, a conversation lazily created by a
  // normal message (after "New conversation," or on a citizen's very first
  // message ever) never registers as "active" here, so deleting it later
  // wouldn't be recognized as deleting the ACTIVE conversation.
  syncActiveConversationId: (id: string | null) => void
}

const ConversationsContext = createContext<ConversationsCtx>({
  conversations: [],
  activeConversationId: null,
  pendingMessages: null,
  clearPendingMessages: () => {},
  refreshConversations: async () => {},
  selectConversation: async () => {},
  startNewConversation: async () => {},
  removeConversation: async () => {},
  syncActiveConversationId: () => {},
})

export function useConversations() {
  return useContext(ConversationsContext)
}

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { citizen, sessionId } = useCitizen()
  const citizenId = citizen?.citizenId

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [pendingMessages, setPendingMessages] = useState<ConversationMessage[] | null>(null)

  const refreshConversations = useCallback(async () => {
    if (!citizenId) { setConversations([]); return }
    try {
      const res = await fetch("/api/conversation", { headers: { "x-citizen-id": citizenId } })
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch {
      // best-effort — sidebar just keeps showing whatever it last had
    }
  }, [citizenId])

  // Initial load, and whenever citizenId becomes available (onboarding
  // completes / citizen loads).
  useEffect(() => { refreshConversations() }, [refreshConversations])

  const selectConversation = useCallback(async (id: string) => {
    if (!citizenId) return
    try {
      // Activate FIRST — if this fails, don't load messages either (fail
      // closed rather than show a conversation that continue-style can't
      // actually continue).
      const activateRes = await fetch(`/api/conversation/${id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-citizen-id": citizenId },
        body: JSON.stringify({ sessionId }),
      })
      if (!activateRes.ok) return

      const msgsRes = await fetch(`/api/conversation/${id}`, { headers: { "x-citizen-id": citizenId } })
      if (!msgsRes.ok) return
      const data = await msgsRes.json()

      setActiveConversationId(id)
      setPendingMessages(data.messages || [])
      // Move it to the top locally, without waiting for a full list refetch.
      setConversations(prev => {
        const found = prev.find(c => c.id === id)
        if (!found) return prev
        return [{ ...found, updatedAt: new Date().toISOString() }, ...prev.filter(c => c.id !== id)]
      })
    } catch {
      // best-effort — clicking a conversation that fails to load just does nothing
    }
  }, [citizenId, sessionId])

  const startNewConversation = useCallback(async () => {
    try {
      await fetch("/api/conversation/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
    } catch {
      // best-effort — worst case the next turn appends to the old
      // conversation instead of starting fresh; still resets the UI below
    }
    setActiveConversationId(null)
    setPendingMessages([]) // the "reset to welcome" sentinel
  }, [sessionId])

  const removeConversation = useCallback(async (id: string) => {
    if (!citizenId) return
    try {
      await fetch(`/api/conversation/${id}`, { method: "DELETE", headers: { "x-citizen-id": citizenId } })
    } catch {
      // best-effort; fall through to optimistic local removal regardless
    }
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConversationId === id) {
      // Deleting the ACTIVE conversation — don't leave a dangling active id
      // pointing at a now-deleted row. Clear server-side too, same as
      // startNewConversation, so the next turn lazily creates a fresh one.
      try {
        await fetch("/api/conversation/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
      } catch {
        // best-effort
      }
      setActiveConversationId(null)
      setPendingMessages([])
    }
  }, [citizenId, sessionId, activeConversationId])

  const clearPendingMessages = useCallback(() => setPendingMessages(null), [])
  const syncActiveConversationId = useCallback((id: string | null) => setActiveConversationId(id), [])

  return (
    <ConversationsContext.Provider value={{
      conversations, activeConversationId, pendingMessages, clearPendingMessages,
      refreshConversations, selectConversation, startNewConversation, removeConversation,
      syncActiveConversationId,
    }}>
      {children}
    </ConversationsContext.Provider>
  )
}
