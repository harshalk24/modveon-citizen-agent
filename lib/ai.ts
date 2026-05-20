import { GoogleGenerativeAI, Content } from "@google/generative-ai"

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const MODEL = "gemini-2.0-flash"

export async function streamChat(params: {
  systemPrompt: string
  messages: { role: "user" | "model"; parts: string }[]
  maxTokens?: number
}) {
  const model = gemini.getGenerativeModel({
    model: MODEL,
    systemInstruction: params.systemPrompt,
    generationConfig: {
      maxOutputTokens: params.maxTokens || 400,
      temperature: 0.3,
    }
  })
  // Gemini requires history to start with a user turn — strip leading model messages
  const allButLast = params.messages.slice(0, -1)
  const firstUserIdx = allButLast.findIndex(m => m.role === "user")
  const historyMsgs = firstUserIdx >= 0 ? allButLast.slice(firstUserIdx) : []

  const history: Content[] = historyMsgs.map(m => ({
    role: m.role,
    parts: [{ text: m.parts }],
  }))

  const chat = model.startChat({ history })
  const last = params.messages[params.messages.length - 1]
  const result = await chat.sendMessageStream(last.parts)
  return result.stream
}

export async function generatePlan(params: {
  services: any[]
  profile: any
  language?: "en" | "es"
}): Promise<any> {
  const model = gemini.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 2000,
      temperature: 0.1,
    }
  })

  const isEs = params.language === "es"
  const prompt = `Generate a week-by-week action plan for this citizen.
Profile: ${JSON.stringify(params.profile)}
Services: ${JSON.stringify(params.services)}

Return ONLY this JSON structure:
{"weeks":[{"week":1,"label":"string","steps":[{"serviceId":"string","title":"string","agency":"string","agencyAddress":"string","deadline":"string or null","estimatedTime":"string","cost":"string","documents":["string"],"whatToSayWhenYouArrive":"string","whatToDoIfProblems":"string","canDoOnline":false,"onlineUrl":"string or null","why":"string"}]}]}

Rules:
- Max 3 steps per week. Spread steps across multiple weeks if needed.
- serviceId must match one of the provided service IDs exactly.
- dependsOn: put dependencies in earlier weeks.
- Language: ${isEs ? "Salvadoran Spanish, use 'vos'" : "English"}.
- cost: "Free" or exact amount. estimatedTime: realistic (e.g. "30 minutos en persona").
- whatToSayWhenYouArrive: one specific sentence to say at the counter.
- whatToDoIfProblems: one sentence naming a specific escalation contact.
- Output ONLY JSON, no markdown, no explanation.`

  let text = ""
  try {
    const result = await model.generateContent(prompt)
    text = result.response.text()
  } catch (geminiErr: any) {
    console.error("Gemini generatePlan error:", geminiErr?.message ?? geminiErr)
    throw new Error(`Gemini API error: ${geminiErr?.message ?? "unknown"}`)
  }

  // Strip any accidental markdown fences before parsing
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch (parseErr: any) {
    console.error("generatePlan JSON.parse failed. Raw response (first 500 chars):", cleaned.slice(0, 500))
    throw new Error(`Gemini returned non-JSON: ${parseErr.message}`)
  }
}

export async function summariseConversation(messages: any[], language: "en" | "es" = "en"): Promise<string> {
  const model = gemini.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 200, temperature: 0.1 }
  })

  const prompt = language === "es"
    ? `Resumí esta conversación en máximo 3 oraciones cortas. Solo incluí hechos relevantes sobre la situación del ciudadano. No incluyas saludos ni frases genéricas.\nConversación: ${JSON.stringify(messages)}`
    : `Summarize this conversation in at most 3 short sentences. Include only relevant facts about the citizen's situation. No greetings or generic phrases.\nConversation: ${JSON.stringify(messages)}`

  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}
