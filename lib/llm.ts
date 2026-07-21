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

// Task SLM_LOCAL_HARNESS — a lightweight tag for WHICH internal step a call
// is for. Purely a label today unless SLM_DEV routing (below) reads it;
// this is the hook Phase 3's full production router reuses.
export type LLMPurpose = "classify" | "title" | "generate" | "ground"

export interface CompleteOpts {
  temperature?: number
  maxTokens?: number
  json?: boolean
  purpose?: LLMPurpose
}

export interface StreamChatOpts {
  temperature?: number
  maxTokens?: number
  purpose?: LLMPurpose
}

export interface LLMProvider {
  complete(prompt: string, opts?: CompleteOpts): Promise<string>
  streamChat(systemPrompt: string, messages: ChatMessage[], opts?: StreamChatOpts): AsyncIterable<string>
}

const PROVIDER      = (process.env.LLM_PROVIDER || "openai").toLowerCase()
const OPENAI_MODEL      = process.env.OPENAI_MODEL || "gpt-4o-mini"
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || OPENAI_MODEL
const GEMINI_MODEL      = process.env.GEMINI_MODEL || "gemini-2.0-flash"

// ── OpenAI-compatible backend ────────────────────────────────────────
// Task SLM_LOCAL_HARNESS: parameterized (baseURL/apiKey/model) rather than
// hardcoded to api.openai.com, so the SAME request/streaming logic serves
// both the real OpenAI API and a local Ollama server (which exposes an
// OpenAI-compatible endpoint) — just different config, no duplicated
// protocol code.
interface OpenAICompatConfig {
  label: string // for logs/audit — e.g. "openai" or "ollama"
  apiKey: string
  baseURL?: string
  completeModel: string
  chatModel: string
}

class OpenAICompatBackend implements LLMProvider {
  private _client: OpenAI | null = null
  constructor(private config: OpenAICompatConfig) {}

  private client(): OpenAI {
    if (!this._client) this._client = new OpenAI({ apiKey: this.config.apiKey, baseURL: this.config.baseURL })
    return this._client
  }

  get modelLabel(): string {
    return `${this.config.label}:${this.config.chatModel}`
  }

  async complete(prompt: string, opts: CompleteOpts = {}): Promise<string> {
    const res = await this.client().chat.completions.create({
      model:           this.config.completeModel,
      messages:        [{ role: "user", content: prompt }],
      temperature:     opts.temperature ?? 0.7,
      max_tokens:      opts.maxTokens,
      response_format: opts.json ? { type: "json_object" } : undefined,
    })
    return res.choices[0]?.message?.content ?? ""
  }

  async *streamChat(systemPrompt: string, messages: ChatMessage[], opts: StreamChatOpts = {}): AsyncIterable<string> {
    const stream = await this.client().chat.completions.create({
      model:       this.config.chatModel,
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

let _defaultBackend: LLMProvider | null = null
function getDefaultBackend(): LLMProvider {
  if (_defaultBackend) return _defaultBackend
  _defaultBackend = PROVIDER === "gemini"
    ? new GeminiBackend()
    : new OpenAICompatBackend({
        label:         "openai",
        apiKey:        process.env.OPENAI_API_KEY || "",
        completeModel: OPENAI_MODEL,
        chatModel:     OPENAI_CHAT_MODEL,
      })
  return _defaultBackend
}

function getDefaultLabel(): string {
  return PROVIDER === "gemini" ? `gemini:${GEMINI_MODEL}` : `openai:${OPENAI_CHAT_MODEL}`
}

// ── Task SLM_LOCAL_HARNESS — dev-only Ollama routing ────────────────────
// Phase 3 slice 1: lets Harshal run the real agent against a local SLM
// (Gemma via Ollama) for specific purposes, $0/no-Gemini/no-tunnel, to feel
// real local latency and quality through the actual app. NOT the production
// router — see the task doc for what's deferred.
//
// SLM_DEV=1 turns this on at all; SLM_ROUTE (default "classify,title") lists
// which purposes get sent to Ollama. Both unset/off → getDefaultBackend()
// only, identical to today's behavior, zero Ollama contact.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b"

let _ollamaBackend: OpenAICompatBackend | null = null
function getOllamaBackend(): OpenAICompatBackend {
  if (!_ollamaBackend) {
    _ollamaBackend = new OpenAICompatBackend({
      label:         "ollama",
      // Ollama's OpenAI-compatible endpoint doesn't check the key, but the
      // OpenAI client requires a non-empty string.
      apiKey:        "ollama",
      baseURL:       process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
      completeModel: OLLAMA_MODEL,
      chatModel:     OLLAMA_MODEL,
    })
  }
  return _ollamaBackend
}

function isSlmDevEnabled(): boolean {
  return process.env.SLM_DEV === "1"
}

function getSlmRoutedPurposes(): Set<string> {
  const raw = process.env.SLM_ROUTE ?? "classify,title"
  return new Set(raw.split(",").map(s => s.trim()).filter(Boolean))
}

// HARD rule, enforced here (not just documented): grounding/faithfulness
// checks never go to the SLM, even if "ground" is listed in SLM_ROUTE.
function shouldRouteToSlm(purpose?: LLMPurpose): boolean {
  if (!purpose || purpose === "ground") return false
  if (!isSlmDevEnabled()) return false
  return getSlmRoutedPurposes().has(purpose)
}

// Tracks which backend ACTUALLY served the most recent call per purpose —
// including when a routed call errored and fell back — so a caller wanting
// to record what truly happened this turn (e.g. the chat route's audit log)
// reads the real outcome, not just the static routing intent.
const lastServedLabel = new Map<string, string>()

export function getActiveModelLabel(purpose?: LLMPurpose): string {
  if (purpose && lastServedLabel.has(purpose)) return lastServedLabel.get(purpose)!
  return shouldRouteToSlm(purpose) ? getOllamaBackend().modelLabel : getDefaultLabel()
}

// The router — implements the same LLMProvider interface, so every existing
// call site (`getLLM().complete(...)` / `getLLM().streamChat(...)`) is
// unchanged except for adding `purpose` to opts. Dispatches per-call on
// opts.purpose; a dead/misconfigured Ollama falls back to the default
// backend with a logged warning rather than failing the turn.
class RoutingProvider implements LLMProvider {
  async complete(prompt: string, opts: CompleteOpts = {}): Promise<string> {
    if (shouldRouteToSlm(opts.purpose)) {
      const ollama = getOllamaBackend()
      try {
        const result = await ollama.complete(prompt, opts)
        lastServedLabel.set(opts.purpose!, ollama.modelLabel)
        console.log(`[LLM] ${opts.purpose} → ${ollama.modelLabel}`)
        return result
      } catch (e) {
        console.warn(`[LLM] Ollama unavailable for purpose=${opts.purpose} (${e instanceof Error ? e.message : e}) — falling back to ${getDefaultLabel()}`)
      }
    }
    const result = await getDefaultBackend().complete(prompt, opts)
    if (opts.purpose) {
      lastServedLabel.set(opts.purpose, getDefaultLabel())
      console.log(`[LLM] ${opts.purpose} → ${getDefaultLabel()}`)
    }
    return result
  }

  async *streamChat(systemPrompt: string, messages: ChatMessage[], opts: StreamChatOpts = {}): AsyncIterable<string> {
    if (shouldRouteToSlm(opts.purpose)) {
      const ollama = getOllamaBackend()
      try {
        // Buffered rather than yielded live: must fully validate the Ollama
        // stream succeeds before committing to it, so a mid-stream failure
        // falls back cleanly instead of handing the citizen a half-Ollama,
        // half-OpenAI reply. No responsiveness cost in this app specifically
        // — the caller (generateFull in the chat route) already buffers the
        // entire stream before grounding/sending it onward, so nothing here
        // was streaming live to the citizen either way.
        const chunks: string[] = []
        for await (const chunk of ollama.streamChat(systemPrompt, messages, opts)) chunks.push(chunk)
        lastServedLabel.set(opts.purpose!, ollama.modelLabel)
        console.log(`[LLM] ${opts.purpose} → ${ollama.modelLabel}`)
        for (const chunk of chunks) yield chunk
        return
      } catch (e) {
        console.warn(`[LLM] Ollama unavailable for purpose=${opts.purpose} (${e instanceof Error ? e.message : e}) — falling back to ${getDefaultLabel()}`)
      }
    }
    if (opts.purpose) {
      lastServedLabel.set(opts.purpose, getDefaultLabel())
      console.log(`[LLM] ${opts.purpose} → ${getDefaultLabel()}`)
    }
    yield* getDefaultBackend().streamChat(systemPrompt, messages, opts)
  }
}

let _router: RoutingProvider | null = null

export function getLLM(): LLMProvider {
  if (!_router) _router = new RoutingProvider()
  return _router
}
