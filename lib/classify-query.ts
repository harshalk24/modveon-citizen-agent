import { getLLM } from "@/lib/llm"

export type QueryType =
  | "out-of-scope"        // nothing to do with El Salvador government services
  | "service-lookup"      // citizen describing a new situation to get benefits
  | "depth-knowledge"     // explain a benefit, eligibility, document, process
  | "plan-clarification"  // explain a step in their action plan
  | "diaspora-navigation" // poder, consulate, property from abroad
  | "open-ended"          // what else can I apply for (already has context)
  | "no-context-open"     // asking for benefits but no situation given yet
  | "meta"                // asking about the assistant itself, or what it knows about them

const VALID_TYPES: QueryType[] = [
  "out-of-scope",
  "service-lookup",
  "depth-knowledge",
  "plan-clarification",
  "diaspora-navigation",
  "open-ended",
  "no-context-open",
  "meta",
]

export type LifeEvent = "new-baby" | "job-loss" | "start-business" | "diaspora"
const VALID_LIFE_EVENTS: LifeEvent[] = ["new-baby", "job-loss", "start-business", "diaspora"]

export type Employment = "formal" | "informal" | "unemployed" | "unknown"
const VALID_EMPLOYMENT: Employment[] = ["formal", "informal", "unemployed", "unknown"]

export type MemoryType = "discard" | "session" | "episodic" | "durable"
const VALID_MEMORY_TYPES: MemoryType[] = ["discard", "session", "episodic", "durable"]

export interface Classification {
  type: QueryType
  confidence: number // 0..1
  lifeEvent: LifeEvent | null
  lifeEventConfidence: number // 0..1
  employment: Employment
  employmentConfidence: number // 0..1
  memoryType: MemoryType
  memoryTypeConfidence: number // 0..1
}

export async function classifyQuery(params: {
  message: string
  hasLifeEvent: boolean
  hasEntitlements: boolean
  conversationHistory: string
}): Promise<Classification> {
  const prompt = `You are classifying a citizen's message to a government services assistant for El Salvador.

Citizen context:
- Has described a life situation already: ${params.hasLifeEvent}
- Has seen benefit results already: ${params.hasEntitlements}
- Recent conversation: ${params.conversationHistory || "none"}

Citizen message: "${params.message}"

Classify this message into exactly ONE of these types:

"out-of-scope" — the message has nothing to do with El Salvador government services, benefits, documents, or citizen navigation. This includes general knowledge questions, trivia, personal advice unrelated to government, questions about other countries' governments, weather, sports, coding, math, or any topic that a government citizen assistant would never handle.
Examples: "what is the capital of India?", "who won the World Cup?", "how do I code in Python?", "what's the weather today?", "tell me a joke", "what's 2+2?", "who is the president of France?"

"service-lookup" — citizen is describing a new life situation and wants to know what government benefits they qualify for.
Examples: "I just had a baby", "I lost my job", "I want to register my business", "me quedé sin trabajo", "acabo de tener un bebé"

"depth-knowledge" — citizen is asking a follow-up question about a specific benefit, document, eligibility criteria, or process they already saw or want explained.
Examples: "how do I know I qualify?", "what is a DUI?", "tell me more about maternity benefit", "how long does it take?", "what are the requirements?", "explain the child subsidy", "am I eligible?", "Cómo sé si califico?", "tell me about the document"

"plan-clarification" — citizen doesn't understand a step in their action plan.
Examples: "I don't understand step 2", "what do I do at RNPN?", "explain this step", "what do I say when I arrive?"

"diaspora-navigation" — citizen needs help with consular services, poder notarial, or managing El Salvador affairs from abroad.
Examples: "I need a poder from the US", "my parents want to sell the house", "I'm in Los Angeles and need to...", "apostille", "consulate"

"open-ended" — citizen already has context/results (hasLifeEvent=true or hasEntitlements=true) and wants to know what else they qualify for.
Examples: "what else can I apply for?", "any other benefits?", "what am I missing?", "what other schemes exist?"

"no-context-open" — citizen is asking about benefits or schemes in general but has NOT described their situation yet (hasLifeEvent=false and hasEntitlements=false).
Examples: "what schemes am I eligible for?", "what benefits exist?", "what can I apply for?", "qué beneficios hay?"

"meta" — the citizen is asking about YOU (the assistant) — who/what you are, what you can do — OR about what you already know about THEM (their own stored situation/profile). Not a benefit lookup and not out-of-scope.
Examples: "who are you?", "what can you do?", "what is this?", "what do you know about me?", "what's my situation?", "what have I told you?", "¿quién sos?", "¿qué sabés de mí?"

For "confidence": be calibrated, not reflexively high. Use 0.9+ only when the message clearly and unambiguously fits one type. Lower it (e.g. 0.3-0.6) when the message is vague, garbled, off-topic-but-contains-a-keyword, could plausibly fit more than one type, or is about a third party rather than the citizen themself.
Example of a LOW-confidence case: message = "asdkj store baby ??? idk lol" → {"type": "out-of-scope", "confidence": 0.4} — because it's garbled and only loosely touches two different topics without clearly being about either.
Example of a HIGH-confidence case: message = "I just had a baby" → {"type": "service-lookup", "confidence": 0.95} — clear and unambiguous.

Also detect two more independent facets from the message, each with its own confidence:

"lifeEvent" — does this message describe the CITIZEN THEMSELF experiencing one of these life events right now? One of: "new-baby" (they had/are having a baby), "job-loss" (they lost their job), "start-business" (they are starting/registering a business), "diaspora" (they are managing El Salvador affairs from abroad). Use null if the message doesn't describe the citizen having a new life event (e.g. it's a follow-up question, off-topic, or about a THIRD PARTY like "my sister" or "my cousin" rather than the citizen). Also use null when the message is a QUESTION about whether something is possible, allowed, or advisable, or a HYPOTHETICAL/CONDITIONAL — e.g. "can I…", "could I…", "should I…", "if I…", "what if…", "am I allowed to…", "¿puedo…?", "¿si yo…?". These are questions, not a declaration that the citizen is entering that situation. Only return a life-event slug when the citizen DECLARES an actual or imminent change ("I'm starting a business", "I lost my job", "I just had a baby"). Give it its own "lifeEventConfidence" (0 to 1) — use the same calibration rules as above: a message about a third party, or one that only loosely touches the topic, should get LOW lifeEventConfidence even if you still guess a slug.

"employment" — the citizen's employment status, one of exactly: "formal" (a formal/contract job, an employer, ISSS/AFP contributions), "informal" (self-employed, freelance, street vendor, no contract), "unemployed" (no job, lost their job, out of work), or "unknown" (not stated in this message). Give it its own "employmentConfidence" (0 to 1) — use "unknown" with LOW confidence when the message says nothing about employment.

Also detect a "memoryType" facet — what from this message is worth remembering later — with its own "memoryTypeConfidence":

"discard" — greetings, thanks, small talk, or out-of-scope messages. Nothing worth remembering.
Examples: "Hi, good afternoon", "thanks!", "who won the World Cup?"

"session" — relevant only to THIS conversation (a clarifying question, "tell me more", asking about something already shown). Already covered by the conversation summary — no new fact to store.
Examples: "Tell me more about the maternity benefit", "what do I do at RNPN?", "how long does it take?"

"episodic" — the citizen reports something that HAPPENED — a completed event worth remembering, not a standing fact about who they are.
Examples: "I registered the birth yesterday", "I already got my NIT", "I submitted the form last week"

"durable" — a STABLE FACT about the citizen — describes who they are or their ongoing situation, not a one-time event.
Examples: "I work formally", "I had a baby" (their situation changed), "I'm self-employed"

The critical distinction is durable (a stable fact/situation) vs episodic (a completed event): "I had a baby" describes an ongoing new situation (durable); "I registered the birth" describes a completed action (episodic). When genuinely unsure between the two, pick the more likely one and lower memoryTypeConfidence accordingly.

IMPORTANT — "type", "lifeEvent", "employment", and "memoryType" are four SEPARATE fields with four SEPARATE, NON-OVERLAPPING vocabularies. Never put a memoryType value (discard/session/episodic/durable), a lifeEvent slug, or an employment value into the "type" field — "type" must always be one of the eight message-type labels defined above, no exceptions. If a message is a plain statement with no clear request (e.g. "I have a formal job with a contract"), still choose the closest of the eight type labels (usually "no-context-open" or "depth-knowledge") and lower "confidence" accordingly — never substitute a value from another facet's vocabulary.

Return ONLY this JSON with no other text:
{"type": "<one of the eight types above>", "confidence": <0 to 1>, "lifeEvent": "<one of new-baby|job-loss|start-business|diaspora, or null>", "lifeEventConfidence": <0 to 1>, "employment": "<one of formal|informal|unemployed|unknown>", "employmentConfidence": <0 to 1>, "memoryType": "<one of discard|session|episodic|durable>", "memoryTypeConfidence": <0 to 1>}`

  const failSafe = (type: QueryType): Classification => ({
    type, confidence: 0, lifeEvent: null, lifeEventConfidence: 0, employment: "unknown", employmentConfidence: 0,
    memoryType: "discard", memoryTypeConfidence: 0,
  })

  const asConfidence = (value: unknown): number =>
    typeof value === "number" && value >= 0 && value <= 1 ? value : 0

  try {
    const text = (await getLLM().complete(prompt, { temperature: 0.0, maxTokens: 200, json: true })).trim()
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
    const confidence = asConfidence(parsed.confidence)
    const lifeEventConfidence = asConfidence(parsed.lifeEventConfidence)
    const employmentConfidence = asConfidence(parsed.employmentConfidence)
    const memoryTypeConfidence = asConfidence(parsed.memoryTypeConfidence)
    const lifeEvent = VALID_LIFE_EVENTS.includes(parsed.lifeEvent) ? (parsed.lifeEvent as LifeEvent) : null
    const employment = VALID_EMPLOYMENT.includes(parsed.employment) ? (parsed.employment as Employment) : "unknown"
    // Invalid/missing memoryType is never stored — same fail-safe rule as everything else.
    const memoryTypeValid = VALID_MEMORY_TYPES.includes(parsed.memoryType)
    const memoryType = memoryTypeValid ? (parsed.memoryType as MemoryType) : "discard"

    if (VALID_TYPES.includes(parsed.type)) {
      return {
        type: parsed.type as QueryType, confidence,
        lifeEvent, lifeEventConfidence,
        employment, employmentConfidence,
        memoryType, memoryTypeConfidence: memoryTypeValid ? memoryTypeConfidence : 0,
      }
    }

    // Fallback if LLM returns unexpected value — treat as low confidence, never crash.
    console.warn("classifyQuery: unexpected type:", parsed.type, "— falling back")
    return failSafe(params.hasLifeEvent ? "open-ended" : "service-lookup")
  } catch (e) {
    console.error("classifyQuery failed:", e)
    // Parse/API failure = low confidence = no durable write downstream (fail safe).
    return failSafe("service-lookup")
  }
}
