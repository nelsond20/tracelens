import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import type { DataProvider, WindowState } from './types.js'

const TMP_DIR = '/tmp'

export class WindowProvider extends EventEmitter implements DataProvider<WindowState> {
  private interval: ReturnType<typeof setInterval> | null = null

  constructor(private readonly pollMs = 30_000) {
    super()
  }

  start(): void {
    this.poll()
    this.interval = setInterval(() => this.poll(), this.pollMs)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private poll(): void {
    try {
      const files = fs.readdirSync(TMP_DIR) as string[]
      const cacheFile = files.find(f => f.match(/^ctx-ceiling-\d+\.json$/))
      if (!cacheFile) return

      const raw = fs.readFileSync(`${TMP_DIR}/${cacheFile}`, 'utf8')
      const data = JSON.parse(raw)

      const state: WindowState = {
        windowStart: data.windowStart,
        windowEnd: data.windowEnd,
        estimatedCeiling: data.estimatedCeiling,
        ceilingLevel: data.ceilingLevel,
        calculatedAt: data.calculatedAt,
      }

      this.emit('data', state)
    } catch {
      // silencioso: cache puede no existir o estar siendo escrito
    }
  }
}
