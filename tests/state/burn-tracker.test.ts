import { describe, it, expect, beforeEach } from 'vitest'
import { BurnTracker } from '../../src/state/burn-tracker.js'

describe('BurnTracker', () => {
  let tracker: BurnTracker

  beforeEach(() => { tracker = new BurnTracker() })

  it('returns 0 when no events', () => {
    expect(tracker.getBurnRate('agent-1')).toBe(0)
  })

  it('calculates tokens per minute over 5-minute window', () => {
    const now = Date.now()
    tracker.recordTokens('agent-1', 500, now - 4 * 60 * 1000)  // 4 min ago
    tracker.recordTokens('agent-1', 500, now - 2 * 60 * 1000)  // 2 min ago
    // 1000 tokens in 5 min = 200 tok/min
    expect(tracker.getBurnRate('agent-1', now)).toBeCloseTo(200)
  })

  it('ignores events older than 5 minutes', () => {
    const now = Date.now()
    tracker.recordTokens('agent-1', 10_000, now - 6 * 60 * 1000)  // 6 min ago (outside window)
    tracker.recordTokens('agent-1', 500, now - 1 * 60 * 1000)     // 1 min ago
    expect(tracker.getBurnRate('agent-1', now)).toBeCloseTo(100)   // solo 500/5
  })

  it('tracks different agents independently', () => {
    const now = Date.now()
    tracker.recordTokens('agent-1', 1000, now - 1 * 60 * 1000)
    tracker.recordTokens('agent-2', 2000, now - 1 * 60 * 1000)
    expect(tracker.getBurnRate('agent-1', now)).toBeCloseTo(200)
    expect(tracker.getBurnRate('agent-2', now)).toBeCloseTo(400)
  })
})
