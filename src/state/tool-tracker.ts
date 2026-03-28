export class ToolTracker {
  private state = new Map<string, Record<string, number>>()

  recordTools(key: string, tools: Record<string, number>): void {
    const existing = this.state.get(key) ?? {}
    for (const [name, count] of Object.entries(tools)) {
      existing[name] = (existing[name] ?? 0) + count
    }
    this.state.set(key, existing)
  }

  clearTools(key: string): void {
    this.state.delete(key)
  }

  getTools(key: string): Record<string, number> | null {
    return this.state.get(key) ?? null
  }
}
