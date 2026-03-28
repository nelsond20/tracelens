import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { DataProvider, SessionEvent } from './types.js'

const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions')

export class SessionProvider extends EventEmitter implements DataProvider<SessionEvent> {
  private watcher: fs.FSWatcher | null = null
  private pidToSession = new Map<string, string>()       // pid → sessionId
  private sessionPids = new Map<string, Set<string>>()    // sessionId → Set<pid>
  private emitted = new Map<string, SessionEvent>()       // sessionId → last emitted event

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
        const sessionId = data.sessionId as string
        currentPids.add(pid)

        if (this.pidToSession.has(pid)) continue

        this.pidToSession.set(pid, sessionId)
        let pids = this.sessionPids.get(sessionId)
        if (!pids) {
          pids = new Set()
          this.sessionPids.set(sessionId, pids)
        }
        pids.add(pid)

        if (!this.emitted.has(sessionId)) {
          const event: SessionEvent = {
            sessionId,
            pid: data.pid,
            cwd: data.cwd,
            startedAt: data.startedAt,
            kind: data.kind ?? 'interactive',
            active: true,
          }
          this.emitted.set(sessionId, event)
          this.emit('data', event)
        }
      } catch { /* skip malformed file */ }
    }

    for (const [pid, sessionId] of this.pidToSession) {
      if (!currentPids.has(pid)) {
        this.pidToSession.delete(pid)
        const pids = this.sessionPids.get(sessionId)
        if (pids) {
          pids.delete(pid)
          if (pids.size === 0) {
            this.sessionPids.delete(sessionId)
            const event = this.emitted.get(sessionId)
            if (event) {
              this.emitted.delete(sessionId)
              this.emit('data', { ...event, active: false })
            }
          }
        }
      }
    }
  }

  getSessions(): SessionEvent[] {
    return [...this.emitted.values()]
  }
}
