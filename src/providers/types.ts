import type { EventEmitter } from 'node:events'

export interface DataProvider<T> extends EventEmitter {
  start(): void
  stop(): void
}

export interface SessionEvent {
  sessionId: string
  pid: number
  cwd: string
  startedAt: number
  kind: string
  active: boolean  // false = sesión terminada (archivo eliminado)
}

export interface UsageData {
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
}

export interface JournalEvent {
  sessionId: string
  agentId: string | null   // null = orquestador
  model: string
  usage: UsageData
  timestamp: string        // ISO 8601
  isSidechain: boolean
  filePath: string
}

export interface WindowState {
  windowStart: number       // epoch segundos
  windowEnd: number         // epoch segundos (= resets_at)
  estimatedCeiling: number  // tokens
  ceilingLevel: 'Bajo' | 'Medio' | 'Alto'
  calculatedAt: string      // ISO 8601
}
