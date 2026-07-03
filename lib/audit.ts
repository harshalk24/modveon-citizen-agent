import { prisma } from "@/lib/prisma"
import { getActiveModelLabel } from "@/lib/llm"

export function logResponse(params: {
  citizenId?: string
  sessionId?: string
  prompt: string
  response: string
  kbSourceIds: string[]
  model?: string
  latencyMs?: number
}) {
  prisma.responseLog.create({
    data: {
      citizenId: params.citizenId,
      sessionId: params.sessionId,
      prompt: params.prompt.slice(0, 2000),
      response: params.response.slice(0, 4000),
      kbSourceIds: JSON.stringify(params.kbSourceIds),
      model: params.model || getActiveModelLabel(),
      latencyMs: params.latencyMs,
    }
  }).catch(console.error)
}
