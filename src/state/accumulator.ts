import type { JournalEvent } from '../providers/types.js'
import type { TokenTotals } from './types.js'
import { calculateCost } from '../models/pricing.js'

type AgentKey = string
interface RawEntry { usage: JournalEvent['usage']; timestamp: number; model: string }

export class TokenAccumulator {
  private entries = new Map<AgentKey, RawEntry[]>()
  private windowStart: number | null = null

  setWindowStart(epochSeconds: number): void {
    if (this.windowStart !== epochSeconds) {
      this.windowStart = epochSeconds
      this.entries.clear()
    }
  }

  addEntry(event: JournalEvent): void {
    const ts = new Date(event.timestamp).getTime() / 1000
    if (this.windowStart !== null && ts < this.windowStart) return
    const key = this.key(event.sessionId, event.agentId)
    if (!this.entries.has(key)) this.entries.set(key, [])
    this.entries.get(key)!.push({ usage: event.usage, timestamp: ts, model: event.model })
  }

  getTotals(sessionId: string, agentId: string | null, defaultModel = 'claude-sonnet-4-6'): TokenTotals {
    const entries = this.entries.get(this.key(sessionId, agentId)) ?? []
    const acc = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }
    let lastModel = defaultModel
    for (const e of entries) {
      acc.inputTokens += e.usage.inputTokens
      acc.outputTokens += e.usage.outputTokens
      acc.cacheWriteTokens += e.usage.cacheCreationInputTokens
      acc.cacheReadTokens += e.usage.cacheReadInputTokens
      lastModel = e.model
    }
    const totalTokens = acc.inputTokens + acc.outputTokens + acc.cacheWriteTokens + acc.cacheReadTokens
    return { ...acc, totalTokens, cost: calculateCost(acc, lastModel) }
  }

  getLastModel(sessionId: string, agentId: string | null): string {
    const entries = this.entries.get(this.key(sessionId, agentId)) ?? []
    return entries[entries.length - 1]?.model ?? 'claude-sonnet-4-6'
  }

  keys(): AgentKey[] {
    return [...this.entries.keys()]
  }

  key(sessionId: string, agentId: string | null): AgentKey {
    return `${sessionId}:${agentId ?? '__orch__'}`
  }
}
