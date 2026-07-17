// Task History-C1 — durable conversation history (Postgres), server-only.
// Distinct from lib/session.ts's Redis session (ephemeral, 24h TTL, the
// conversation IN PROGRESS) — this is the permanent record a citizen can
// revisit later. Additive/parallel to the actual chat pipeline: nothing here
// may change a reply, retrieval, or grounding outcome (see app/api/chat/
// route.ts's call sites, which wrap every call here in try/catch and never
// let a failure block the response).
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { generateConversationTitle } from "@/lib/ai"

const TITLE_MAX_LENGTH = 40
// Fires the LLM title upgrade once, right after the conversation's 2nd turn
// (4 messages: user+assistant x2) — "enough context to summarize" per the
// task doc, without waiting so long the citizen's seen a long stretch of the
// truncated placeholder.
const TITLE_UPGRADE_AT_MESSAGE_COUNT = 4

function truncateTitle(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return "New conversation"
  return trimmed.length > TITLE_MAX_LENGTH
    ? trimmed.slice(0, TITLE_MAX_LENGTH).trimEnd() + "…"
    : trimmed
}

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: Date
  // Task I18N_PER_CONVERSATION: fixed at creation, never changes — the
  // sidebar/client uses this to lock the language toggle + follow this
  // conversation's language for chrome while it's the active one.
  language: string
}

export interface ConversationMessage {
  id: string
  role: string
  content: string
  createdAt: Date
}

// Lazy creation (Behavior 1) — a Conversation exists only once it has a
// first message; called only when the active session has no conversationId
// yet. Title is the truncated first message, always present immediately
// (never empty/pending — the LLM upgrade in maybeUpgradeTitle is a later
// opportunistic overwrite, not a precondition).
//
// Task I18N_PER_CONVERSATION: language is the effective language AT THIS
// MOMENT (the client's live global toggle for a brand-new conversation) —
// fixed on the row for the conversation's whole life from here on.
export async function createConversation(citizenId: string, firstMessage: string, language: "en" | "es"): Promise<{ id: string }> {
  return prisma.conversation.create({
    data: { citizenId, title: truncateTitle(firstMessage), language },
    select: { id: true },
  })
}

// Write-through per turn (Behavior 2) — appends both Message rows and bumps
// the conversation's updatedAt. Returns the new total message count so the
// caller can decide whether this turn crosses the title-upgrade threshold.
//
// Task WRITETHROUGH_LATENCY: this used to be `$transaction([create, create,
// update, count])` — 4 statements in the array form, which Prisma sends as 4
// SEPARATE SEQUENTIAL network round trips, not one batched round trip.
// Confirmed live (measure-first, not assumed): this DB's per-round-trip cost
// is a fairly constant ~250-450ms regardless of query complexity (a bare
// `SELECT 1` and a single combined insert+update statement both landed in
// that same range) — so 4 round trips cost ~4x that, matching the measured
// ~1.7-2.9s. It was NEVER connection-establishment (a fresh/cold connection
// was only ~450ms, and a fully-warm one didn't get meaningfully faster) —
// it was purely the round-trip COUNT.
//
// Fixed to 2 round trips: one raw SQL statement doing both inserts + the
// updatedAt bump together (a Postgres data-modifying CTE — the `ins` CTE's
// rows are guaranteed committed by the time this statement returns), then a
// separate `count`. Deliberately NOT folded into a single round trip via a
// trailing `SELECT COUNT(*)` in the same WITH clause — confirmed live that
// Postgres does NOT let an unrelated sibling SELECT in the same statement
// see a writable CTE's own inserts unless there's an explicit CTE-to-CTE
// data dependency (verified directly: it returned the PRE-insert count,
// consistently one round behind, at every single test iteration). Two
// round trips (~500-600ms) is a smaller win than one would have been, but a
// correct one — measured ~70% faster than the original 4-round-trip form.
//
// Message.id is a plain Prisma @default(cuid()) column with no format
// validation anywhere in this codebase (confirmed) — randomUUID() here
// produces a different-looking but equally valid unique string; raw SQL
// bypasses Prisma's generator, so an id must be supplied explicitly.
export async function appendTurn(
  conversationId: string,
  userMessage: string,
  assistantReply: string
): Promise<{ messageCount: number }> {
  await prisma.$executeRaw`
    WITH ins AS (
      INSERT INTO "Message" (id, "conversationId", role, content, "createdAt")
      VALUES
        (${randomUUID()}, ${conversationId}, 'user', ${userMessage}, now()),
        (${randomUUID()}, ${conversationId}, 'assistant', ${assistantReply}, now())
    )
    UPDATE "Conversation" SET "updatedAt" = now() WHERE id = ${conversationId}
  `
  const messageCount = await prisma.message.count({ where: { conversationId } })
  return { messageCount }
}

export function shouldUpgradeTitle(messageCount: number): boolean {
  return messageCount === TITLE_UPGRADE_AT_MESSAGE_COUNT
}

// Task TITLE_OFF_HOTPATH: title upgrade (Behavior 3), off the chat hot path.
// This used to run inline + awaited on the chat turn that crossed the
// threshold, adding ~2.6s to a purely cosmetic update. Now it's its own
// self-contained request (POST /api/conversation/[id]/title, client-
// triggered after the reply renders) — NOT racing the chat function's
// serverless teardown, since it's a whole separate invocation with its own
// lifecycle, not a dangling promise inside another request.
//
// Ownership-scoped (same check as every other conversation endpoint) and
// idempotent: `titleUpgraded` only flips to true on a successful overwrite,
// so a retried/duplicate client call is a true no-op (skips the LLM call
// entirely), while a FAILED attempt leaves it false — a legitimate later
// retry isn't permanently blocked by a bogus "already tried" flag. Returns
// null when the conversation doesn't exist or isn't owned by this citizen
// (caller 404s), matching getConversationMessages's convention.
export async function upgradeTitleIfNeeded(conversationId: string, citizenId: string): Promise<{ upgraded: boolean; title: string } | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, citizenId },
    select: { title: true, titleUpgraded: true },
  })
  if (!conversation) return null
  if (conversation.titleUpgraded) return { upgraded: false, title: conversation.title }

  try {
    const citizen = await prisma.citizen.findUnique({ where: { id: citizenId }, select: { language: true } })
    const language: "en" | "es" = citizen?.language === "es" ? "es" : "en"

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: TITLE_UPGRADE_AT_MESSAGE_COUNT,
      select: { role: true, content: true },
    })
    const title = await generateConversationTitle(messages, language)
    if (title && title.length > 0 && title.length <= 60) {
      await prisma.conversation.update({ where: { id: conversationId }, data: { title, titleUpgraded: true } })
      return { upgraded: true, title }
    }
    return { upgraded: false, title: conversation.title }
  } catch (e) {
    console.error("Title upgrade failed (non-fatal, truncated title remains):", e)
    return { upgraded: false, title: conversation.title }
  }
}

// Delete affordance (Behavior 5) — hard delete, scoped to citizenId so a
// citizen can only ever delete their own conversation. Cascade-removes its
// Messages via the schema's onDelete: Cascade FK. Returns whether a row was
// actually deleted (false = not found or not owned by this citizen — same
// observable outcome, deliberately, so this can't be used to probe which
// conversation ids exist for someone else).
export async function deleteConversation(conversationId: string, citizenId: string): Promise<boolean> {
  const result = await prisma.conversation.deleteMany({ where: { id: conversationId, citizenId } })
  return result.count > 0
}

// List query (Behavior 6) — newest-first by updatedAt, for the sidebar
// (commit 2).
export async function listConversations(citizenId: string): Promise<ConversationSummary[]> {
  return prisma.conversation.findMany({
    where: { citizenId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, language: true },
  })
}

// Fetch one conversation's messages in order (Behavior 6) — scoped to
// citizenId; returns null (not an empty array) when the conversation
// doesn't exist or isn't owned by this citizen, so callers can 404 instead
// of showing an empty conversation. Also returns the conversation's fixed
// language (Task I18N_PER_CONVERSATION) — the client needs it to lock the
// toggle + set chrome language the moment a past conversation is opened.
export async function getConversationMessages(conversationId: string, citizenId: string): Promise<{ language: string; messages: ConversationMessage[] } | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, citizenId },
    select: { id: true, language: true },
  })
  if (!conversation) return null
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
  })
  return { language: conversation.language, messages }
}

// Task History-C2 (STEP 0 finding): commit 1 only ever CLEARED the session's
// active conversationId (app/api/conversation/new) — there was no way to SET
// it to a specific, already-existing conversation. That's the crux of
// continue-style (clicking a past conversation must make the NEXT chat turn
// append to it, not start a new one) — this ownership check backs the new
// activate endpoint that fills that gap. app/api/chat/route.ts's write-through
// trusts whatever conversationId sits in the session without re-checking
// ownership per turn, so this IS the one place that gate has to be enforced —
// without it, a client could point their own session at someone else's real
// conversation id (if guessed/leaked) and have their messages appended there.
export async function conversationExists(conversationId: string, citizenId: string): Promise<boolean> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, citizenId },
    select: { id: true },
  })
  return !!conversation
}
