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
      maxOutputTokens: 1200,
      temperature: 0.1,
    }
  })

  const isEs = params.language === "es"
  const prompt = `
Generate a detailed week-by-week action plan for this citizen.
Profile: ${JSON.stringify(params.profile)}
Services they qualify for: ${JSON.stringify(params.services)}

Return ONLY valid JSON:
{
  "weeks": [{
    "week": 1,
    "label": "string",
    "steps": [{
      "serviceId": "string",
      "title": "string (plain language, under 10 words)",
      "agency": "string",
      "agencyAddress": "string (nearest office or online — be specific, not generic)",
      "deadline": "string or null",
      "estimatedTime": "string (e.g. '30 minutes in person', '10 minutes online')",
      "cost": "string (e.g. 'Free' or '$10.31')",
      "documents": ["string"],
      "whatToSayWhenYouArrive": "string (one sentence script — what to say at the counter)",
      "whatToDoIfProblems": "string (one sentence fallback — who to call or escalate to)",
      "canDoOnline": false,
      "onlineUrl": "string or null",
      "why": "string (why this step must happen in this order, one sentence)"
    }]
  }]
}
Rules:
- Respect dependsOn[] — dependency must appear in an earlier week
- Max 3 steps per week
- Plain ${isEs ? "Salvadoran Spanish (use 'vos')" : "English"} throughout
- estimatedTime must be realistic (not generic like "varies")
- whatToSayWhenYouArrive must be a specific, actionable sentence a citizen can say at the counter
- whatToDoIfProblems must name a specific agency contact or escalation path
- canDoOnline: true only if the service genuinely processes online, not just an informational website
- cost: use "Free" if there is no fee, otherwise give the exact amount
- Output ONLY the JSON, no markdown, no preamble
`
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return JSON.parse(text.replace(/```json|```/g, "").trim())
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
