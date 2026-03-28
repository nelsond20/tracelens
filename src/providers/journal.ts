import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import chokidar, { type FSWatcher } from 'chokidar'
import type { DataProvider, JournalEvent, ToolEvent } from './types.js'

export function extractToolEvent(entry: Record<string, unknown>): ToolEvent | null {
  if (entry['type'] !== 'assistant') return null
  const msg = entry['message'] as Record<string, unknown> | undefined
  if (!msg) return null

  const stopReason = msg['stop_reason'] as string | null
  const sessionId = entry['sessionId'] as string
  const agentId = (entry['agentId'] as string | undefined) ?? null

  if (stopReason === 'tool_use') {
    const content = msg['content'] as Array<Record<string, unknown>> | undefined
    if (!content) return null
    const tools: Record<string, number> = {}
    for (const block of content) {
      if (block['type'] === 'tool_use' && typeof block['name'] === 'string') {
        const name = block['name'] as string
        tools[name] = (tools[name] ?? 0) + 1
      }
    }
    if (Object.keys(tools).length === 0) return null
    return { sessionId, agentId, tools }
  }

  if (stopReason === 'end_turn') {
    return { sessionId, agentId, tools: null }
  }

  return null
}

export class JournalProvider extends EventEmitter implements DataProvider<JournalEvent> {
  private watcher: FSWatcher | null = null
  private offsets = new Map<string, number>()  // filePath → byte offset
  private watchPaths: string[] = []
  private windowStart: number | null = null

  setWindowStart(epochSeconds: number): void {
    this.windowStart = epochSeconds
  }

  setWatchPaths(paths: string[]): void {
    const added = paths.filter(p => !this.watchPaths.includes(p))
    this.watchPaths = paths
    if (this.watcher && added.length > 0) {
      for (const p of added) this.watcher.add(p)
      for (const p of added) this.readFile(p, true)
    }
  }

  start(): void {
    this.watcher = chokidar.watch(this.watchPaths, {
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 500,
    })
    this.watcher.on('change', (filePath: string) => this.readFile(filePath, false))
    for (const p of this.watchPaths) this.readFile(p, true)
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
  }

  private readFile(filePath: string, isInitial: boolean): void {
    if (!fs.existsSync(filePath)) return
    try {
      const stat = fs.statSync(filePath)
      const offset = isInitial ? 0 : (this.offsets.get(filePath) ?? 0)
      if (offset >= stat.size) return

      const fd = fs.openSync(filePath, 'r')
      const buf = Buffer.allocUnsafe(stat.size - offset)
      fs.readSync(fd, buf, 0, buf.length, offset)
      fs.closeSync(fd)
      this.offsets.set(filePath, stat.size)

      const lines = buf.toString('utf8').split('\n').filter(l => l.trim())
      for (const line of lines) {
        let entry: Record<string, unknown>
        try { entry = JSON.parse(line) } catch { continue }

        const event = this.parseJournalEvent(entry, filePath)
        if (event) this.emit('data', event)

        const toolEvent = extractToolEvent(entry)
        if (toolEvent) this.emit('tool', toolEvent)
      }
    } catch { /* skip on read error */ }
  }

  private parseJournalEvent(entry: Record<string, unknown>, filePath: string): JournalEvent | null {
    if (entry['type'] !== 'assistant') return null
    const msg = entry['message'] as Record<string, unknown> | undefined
    if (!msg?.['usage']) return null
    if (msg['stop_reason'] == null) return null  // skip streaming chunks

    const usage = msg['usage'] as Record<string, number>
    const ts = entry['timestamp'] as string
    if (this.windowStart !== null) {
      const epochSec = new Date(ts).getTime() / 1000
      if (epochSec < this.windowStart) return null
    }

    return {
      sessionId: entry['sessionId'] as string,
      agentId: (entry['agentId'] as string | undefined) ?? null,
      model: (msg['model'] as string) ?? 'unknown',
      usage: {
        inputTokens: (usage['input_tokens'] ?? 0),
        outputTokens: (usage['output_tokens'] ?? 0),
        cacheCreationInputTokens: (usage['cache_creation_input_tokens'] ?? 0),
        cacheReadInputTokens: (usage['cache_read_input_tokens'] ?? 0),
      },
      timestamp: ts,
      isSidechain: (entry['isSidechain'] as boolean) ?? false,
      filePath,
    }
  }
}
