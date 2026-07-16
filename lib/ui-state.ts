// Single source of truth for the service / non-service reply-type split.
//
// Non-service replies (meta / out-of-scope / no-context-open) get neutral
// "thinking" verifying copy and no plan CTA; everything else is
// service/gov-grounded. Shared by the chips + Open-plan gating
// (app/chat/page.tsx) and the verifying-copy pre-flight (TASK_VERIFY_COPY),
// so there is exactly one definition to keep them from drifting.
export const NON_SERVICE_UI_STATES = new Set(["meta", "out-of-scope", "no-context-open"])

// Missing uiState => treat as service (backward-compat with pre-tag messages
// persisted before X-UI-State existed). NOTE for the verifying pre-flight:
// a null/unknown classify result is NOT the same as "missing tag on an old
// message" — there, stay neutral by guarding on a definite type first
// (`type && isServiceReplyType(type)`), don't pass null in here expecting neutral.
export function isServiceReplyType(uiState?: string): boolean {
  return !uiState || !NON_SERVICE_UI_STATES.has(uiState)
}
