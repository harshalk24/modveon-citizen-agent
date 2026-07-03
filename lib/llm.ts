// Single provider module for all LLM calls — swap providers via LLM_PROVIDER
// without touching any call site. OpenAI is the default; Gemini is kept as a
// stub behind the same interface for when that key is fixed.

import OpenAI from "openai"
import { GoogleGenerativeAI, Content } from "@google/generative-ai"

export type ChatRole = "system" | "user" | "assistant"
export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface CompleteOpts {
  temperature?: number
  maxTokens?: number
  json?: boolean
}

export interface StreamChatOpts {
  temperature?: number
  maxTokens?: number
}

export interface LLMProvider {
  complete(prompt: string, opts?: CompleteOpts): Promise<string>
  streamChat(systemPrompt: string, messages: ChatMessage[], opts?: StreamChatOpts): AsyncIterable<string>
}

const PROVIDER      = (process.env.LLM_PROVIDER || "openai").toLowerCase()
const OPENAI_MODEL      = process.env.OPENAI_MODEL || "gpt-4o-mini"
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || OPENAI_MODEL
const GEMINI_MODEL      = process.env.GEMINI_MODEL || "gemini-2.0-flash"

// ── OpenAI backend ───────────────────────────────────────────────────
class OpenAIBackend implements LLMProvider {
  private _client: OpenAI | null = null

  private client(): OpenAI {
    if (!this._client) this._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return this._client
  }

  async complete(prompt: string, opts: CompleteOpts = {}): Promise<string> {
    const res = await this.client().chat.completions.create({
      model:           OPENAI_MODEL,
      messages:        [{ role: "user", content: prompt }],
      temperature:     opts.temperature ?? 0.7,
      max_tokens:      opts.maxTokens,
      response_format: opts.json ? { type: "json_object" } : undefined,
    })
    return res.choices[0]?.message?.content ?? ""
  }

  async *streamChat(systemPrompt: string, messages: ChatMessage[], opts: StreamChatOpts = {}): AsyncIterable<string> {
    const stream = await this.client().chat.completions.create({
      model:       OPENAI_CHAT_MODEL,
      messages:    [{ role: "system", content: systemPrompt }, ...messages],
      temperature: opts.temperature ?? 0.3,
      max_tokens:  opts.maxTokens,
      stream:      true,
    })
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content
      if (text) yield text
    }
  }
}

// ── Gemini backend (stub — same behavior as before, kept for rollback) ─
class GeminiBackend implements LLMProvider {
  private _client: GoogleGenerativeAI | null = null

  private client(): GoogleGenerativeAI {
    if (!this._client) this._client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    return this._client
  }

  async complete(prompt: string, opts: CompleteOpts = {}): Promise<string> {
    const model = this.client().getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        maxOutputTokens:  opts.maxTokens,
        temperature:      opts.temperature ?? 0.7,
        responseMimeType: opts.json ? "application/json" : undefined,
      },
    })
    const result = await model.generateContent(prompt)
    return result.response.text()
  }

  async *streamChat(systemPrompt: string, messages: ChatMessage[], opts: StreamChatOpts = {}): AsyncIterable<string> {
    const model = this.client().getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: opts.maxTokens || 400,
        temperature:     opts.temperature ?? 0.3,
      },
    })

    // Gemini requires history to start with a user turn — strip leading model messages
    const allButLast  = messages.slice(0, -1)
    const firstUserIdx = allButLast.findIndex(m => m.role === "user")
    const historyMsgs  = firstUserIdx >= 0 ? allButLast.slice(firstUserIdx) : []

    const history: Content[] = historyMsgs.map(m => ({
      role:  m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }))

    const chat   = model.startChat({ history })
    const last   = messages[messages.length - 1]
    const result = await chat.sendMessageStream(last.content)
    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) yield text
    }
  }
}

let _llm: LLMProvider | null = null

export function getLLM(): LLMProvider {
  if (_llm) return _llm
  _llm = PROVIDER === "gemini" ? new GeminiBackend() : new OpenAIBackend()
  return _llm
}

export function getActiveModelLabel(): string {
  return PROVIDER === "gemini" ? `gemini:${GEMINI_MODEL}` : `openai:${OPENAI_CHAT_MODEL}`
}
