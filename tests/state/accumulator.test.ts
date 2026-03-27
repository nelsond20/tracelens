import { describe, it, expect, beforeEach } from 'vitest'
import { TokenAccumulator } from '../../src/state/accumulator.js'
import type { JournalEvent } from '../../src/providers/types.js'

function makeEvent(overrides: Partial<JournalEvent> = {}): JournalEvent {
  return {
    sessionId: 'sess-1',
    agentId: null,
    model: 'claude-sonnet-4-6',
    usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    timestamp: '2026-03-27T10:00:00.000Z',
    isSidechain: false,
    filePath: '/fake/path.jsonl',
    ...overrides,
  }
}

describe('TokenAccumulator', () => {
  let acc: TokenAccumulator

  beforeEach(() => { acc = new TokenAccumulator() })

  it('accumulates tokens for the same agent', () => {
    acc.addEntry(makeEvent())
    acc.addEntry(makeEvent())
    const totals = acc.getTotals('sess-1', null)
    expect(totals.inputTokens).toBe(200)
    expect(totals.outputTokens).toBe(100)
    expect(totals.totalTokens).toBe(300)
  })

  it('separates orchestrator from sub-agent', () => {
    acc.addEntry(makeEvent())
    acc.addEntry(makeEvent({ agentId: 'agent-1', isSidechain: true }))
    expect(acc.getTotals('sess-1', null).inputTokens).toBe(100)
    expect(acc.getTotals('sess-1', 'agent-1').inputTokens).toBe(100)
  })

  it('filters entries before windowStart', () => {
    const windowStart = new Date('2026-03-27T10:05:00Z').getTime() / 1000
    acc.setWindowStart(windowStart)
    acc.addEntry(makeEvent({ timestamp: '2026-03-27T10:00:00.000Z' }))  // antes
    acc.addEntry(makeEvent({ timestamp: '2026-03-27T10:06:00.000Z' }))  // dentro
    expect(acc.getTotals('sess-1', null).inputTokens).toBe(100)
  })

  it('resets when windowStart changes', () => {
    acc.addEntry(makeEvent())
    acc.setWindowStart(new Date('2026-03-27T11:00:00Z').getTime() / 1000)
    expect(acc.getTotals('sess-1', null).totalTokens).toBe(0)
  })

  it('calculates cost', () => {
    acc.addEntry(makeEvent({ usage: { inputTokens: 1_000_000, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 } }))
    const totals = acc.getTotals('sess-1', null, 'claude-sonnet-4-6')
    expect(totals.cost).toBeCloseTo(3.00)
  })
})
