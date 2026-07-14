import { getLLM, ChatMessage } from "@/lib/llm"

export async function streamChat(params: {
  systemPrompt: string
  messages: { role: "user" | "model"; parts: string }[]
  maxTokens?: number
}) {
  const messages: ChatMessage[] = params.messages.map(m => ({
    role:    m.role === "model" ? "assistant" : "user",
    content: m.parts,
  }))

  const stream = getLLM().streamChat(params.systemPrompt, messages, {
    temperature: 0.3,
    maxTokens:   params.maxTokens || 400,
  })

  // Wrap each yielded string so existing consumers (`chunk.text()`) keep working unchanged.
  async function* wrapped() {
    for await (const text of stream) {
      yield { text: () => text }
    }
  }
  return wrapped()
}

export async function generatePlan(params: {
  services: any[]
  profile: any
  language?: "en" | "es"
  feedback?: string
  // Phase 2a: every situation currently active for this citizen. Without
  // this, a citizen with e.g. new-baby AND job-loss active gets a plan built
  // around only ONE of them — the model has no reason to know `services`
  // spans more than one situation just because it received a longer list.
  situations?: string[]
}): Promise<any> {
  const isEs = params.language === "es"
  const multiSituationNote = params.situations && params.situations.length > 1
    ? `\nIMPORTANT: this citizen has MULTIPLE concurrent situations at once: ${JSON.stringify(params.situations)} — these are simultaneous, not alternatives. Build ONE merged plan that covers services for EVERY one of these situations, not just one of them. Every entry in "Services" below belongs to one of these situations and must be represented by a step somewhere in the plan — do not drop any of them.\n`
    : ""
  const prompt = `Generate a phased action plan for this citizen. Phases are NOT calendar time —
each phase number is a dependency rank: phase 1 must be doable now, phase 2 depends on
something in phase 1 being done first, and so on. Do not imply a calendar schedule
("this week", "next week") anywhere — only mention timing where a step genuinely has a
real deadline or duration.
${multiSituationNote}Profile: ${JSON.stringify(params.profile)}
Services: ${JSON.stringify(params.services)}

Return ONLY this JSON structure:
{"phases":[{"phase":1,"label":"string","steps":[{"serviceId":"string","title":"string","agency":"string","agencyAddress":"string","deadline":"string or null","estimatedTime":"string","cost":"string","documents":["string"],"whatToSayWhenYouArrive":"string","whatToDoIfProblems":"string","canDoOnline":false,"onlineUrl":"string or null","why":"string"}]}]}

Rules:
- Max 3 steps per phase. Spread steps across multiple phases if needed.
- serviceId must match one of the provided service IDs exactly.
- dependsOn: put dependencies in earlier phases.
- label: describe what the phase accomplishes (e.g. "Register the business" or "Once you have your NIT"), never a calendar reference like "Week 1".
- Language: ${isEs ? "Salvadoran Spanish, use 'vos'" : "English"}.
- cost: "Free" or exact amount. estimatedTime: how long the step itself takes at the counter (e.g. "30 minutos en persona") — this describes the errand's duration, not when it happens on a calendar.
- whatToSayWhenYouArrive: one specific sentence to say at the counter.
- whatToDoIfProblems: one sentence naming a specific escalation contact.
- Output ONLY JSON, no markdown, no explanation.${params.feedback ? `\n\nIMPORTANT: ${params.feedback}` : ""}`

  let text = ""
  try {
    text = await getLLM().complete(prompt, { temperature: 0.1, maxTokens: 2000, json: true })
  } catch (err: any) {
    console.error("generatePlan error:", err?.message ?? err)
    throw new Error(`LLM API error: ${err?.message ?? "unknown"}`)
  }

  // Strip any accidental markdown fences before parsing
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch (parseErr: any) {
    console.error("generatePlan JSON.parse failed. Raw response (first 500 chars):", cleaned.slice(0, 500))
    throw new Error(`LLM returned non-JSON: ${parseErr.message}`)
  }
}

export async function summariseConversation(messages: any[], language: "en" | "es" = "en"): Promise<string> {
  const prompt = language === "es"
    ? `Resumí esta conversación en máximo 3 oraciones cortas. Solo incluí hechos relevantes sobre la situación del ciudadano. No incluyas saludos ni frases genéricas.\nConversación: ${JSON.stringify(messages)}`
    : `Summarize this conversation in at most 3 short sentences. Include only relevant facts about the citizen's situation. No greetings or generic phrases.\nConversation: ${JSON.stringify(messages)}`

  const text = await getLLM().complete(prompt, { temperature: 0.1, maxTokens: 200 })
  return text.trim()
}
