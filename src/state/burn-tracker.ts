const WINDOW_MS = 5 * 60 * 1000  // 5 minutos

interface BurnEntry { timestamp: number; tokens: number }

export class BurnTracker {
  private events = new Map<string, BurnEntry[]>()

  recordTokens(agentKey: string, tokens: number, timestamp = Date.now()): void {
    if (!this.events.has(agentKey)) this.events.set(agentKey, [])
    const entries = this.events.get(agentKey)!
    entries.push({ timestamp, tokens })
    // Prune old entries
    const cutoff = timestamp - WINDOW_MS
    this.events.set(agentKey, entries.filter(e => e.timestamp > cutoff))
  }

  getBurnRate(agentKey: string, now = Date.now()): number {
    const cutoff = now - WINDOW_MS
    const entries = (this.events.get(agentKey) ?? []).filter(e => e.timestamp > cutoff)
    if (entries.length === 0) return 0
    const total = entries.reduce((sum, e) => sum + e.tokens, 0)
    return total / 5  // tokens / 5 minutos = tokens por minuto
  }
}
