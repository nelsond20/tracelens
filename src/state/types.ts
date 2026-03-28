import type { WindowState } from '../providers/types.js'

export interface TokenTotals {
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  totalTokens: number
  cost: number
}

export interface AgentState {
  sessionId: string
  agentId: string | null
  name: string
  model: string
  totals: TokenTotals
  burnRatePerMinute: number
  dangerRatio: number
  color: string   // hex
  isSidechain: boolean
  currentTools: Record<string, number> | null
}

export interface SessionState {
  sessionId: string
  cwd: string
  startedAt: number
  orchestrator: AgentState
  subAgents: AgentState[]
  dangerRatio: number
  color: string
}

export interface AppState {
  sessions: SessionState[]
  window: WindowState | null
  totalCost: number
  lastUpdated: number
}
