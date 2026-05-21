import { GoogleGenerativeAI } from "@google/generative-ai"

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export type QueryType =
  | "out-of-scope"        // nothing to do with El Salvador government services
  | "service-lookup"      // citizen describing a new situation to get benefits
  | "depth-knowledge"     // explain a benefit, eligibility, document, process
  | "plan-clarification"  // explain a step in their action plan
  | "diaspora-navigation" // poder, consulate, property from abroad
  | "open-ended"          // what else can I apply for (already has context)
  | "no-context-open"     // asking for benefits but no situation given yet

const VALID_TYPES: QueryType[] = [
  "out-of-scope",
  "service-lookup",
  "depth-knowledge",
  "plan-clarification",
  "diaspora-navigation",
  "open-ended",
  "no-context-open",
]

export async function classifyQuery(params: {
  message: string
  hasLifeEvent: boolean
  hasEntitlements: boolean
  conversationHistory: string
}): Promise<QueryType> {
  const model = gemini.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 50,
      temperature: 0.0, // deterministic
    },
  })

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

Return ONLY this JSON with no other text:
{"type": "<one of the seven types above>"}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())

    if (VALID_TYPES.includes(parsed.type)) {
      return parsed.type as QueryType
    }

    // Fallback if LLM returns unexpected value
    console.warn("classifyQuery: unexpected type:", parsed.type, "— falling back")
    return params.hasLifeEvent ? "open-ended" : "service-lookup"
  } catch (e) {
    console.error("classifyQuery failed:", e)
    return "service-lookup"
  }
}
