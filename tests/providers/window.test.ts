import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WindowProvider } from '../../src/providers/window.js'
import * as fs from 'node:fs'

vi.mock('node:fs')

describe('WindowProvider', () => {
  let provider: WindowProvider

  beforeEach(() => {
    provider = new WindowProvider(100)  // poll cada 100ms en tests
  })

  afterEach(() => { provider.stop() })

  it('emits window state when ceiling cache exists', async () => {
    const cacheData = {
      windowStart: 1774573200,
      windowEnd: 1774591200,
      estimatedCeiling: 72_000_000,
      ceilingLevel: 'Alto',
      calculatedAt: '2026-03-27T10:00:00Z',
    }
    vi.mocked(fs.readdirSync).mockReturnValue(['ctx-ceiling-1774573200.json'] as any)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cacheData))

    const events: any[] = []
    provider.on('data', e => events.push(e))
    provider.start()

    await new Promise(r => setTimeout(r, 150))
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].estimatedCeiling).toBe(72_000_000)
    expect(events[0].ceilingLevel).toBe('Alto')
  })

  it('emits nothing when no cache file exists', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue([])
    const events: any[] = []
    provider.on('data', e => events.push(e))
    provider.start()
    await new Promise(r => setTimeout(r, 150))
    expect(events.length).toBe(0)
  })
})
