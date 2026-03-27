import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { DataProvider, SessionEvent } from './types.js'

const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions')

export class SessionProvider extends EventEmitter implements DataProvider<SessionEvent> {
  private watcher: fs.FSWatcher | null = null
  private known = new Map<string, SessionEvent>()  // pid → event

  start(): void {
    this.scan()
    this.watcher = fs.watch(SESSIONS_DIR, () => this.scan())
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
  }

  private scan(): void {
    if (!fs.existsSync(SESSIONS_DIR)) return
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))
    const currentPids = new Set<string>()

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8')
        const data = JSON.parse(raw)
        const pid = String(data.pid)
        currentPids.add(pid)
        if (!this.known.has(pid)) {
          const event: SessionEvent = {
            sessionId: data.sessionId,
            pid: data.pid,
            cwd: data.cwd,
            startedAt: data.startedAt,
            kind: data.kind ?? 'interactive',
            active: true,
          }
          this.known.set(pid, event)
          this.emit('data', event)
        }
      } catch { /* skip malformed file */ }
    }

    for (const [pid, event] of this.known) {
      if (!currentPids.has(pid)) {
        this.known.delete(pid)
        this.emit('data', { ...event, active: false })
      }
    }
  }

  getSessions(): SessionEvent[] {
    return [...this.known.values()]
  }
}
