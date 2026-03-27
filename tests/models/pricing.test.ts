import { describe, it, expect, beforeEach } from 'vitest'
import { getPricing, calculateCost, loadCustomPricing } from '../../src/models/pricing.js'

describe('getPricing', () => {
  it('returns exact match for known model', () => {
    const p = getPricing('claude-sonnet-4-6')
    expect(p.inputCostPerMToken).toBe(3.00)
    expect(p.outputCostPerMToken).toBe(15.00)
  })

  it('returns fallback for unknown model', () => {
    const p = getPricing('claude-unknown-99')
    expect(p.inputCostPerMToken).toBe(3.00)  // fallback = sonnet pricing
  })
})

describe('calculateCost', () => {
  it('calculates cost correctly for 1M tokens each', () => {
    const cost = calculateCost(
      { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheWriteTokens: 0, cacheReadTokens: 0 },
      'claude-sonnet-4-6'
    )
    expect(cost).toBeCloseTo(18.00)  // $3 + $15
  })

  it('calculates cache read tokens at discounted rate', () => {
    const cost = calculateCost(
      { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 1_000_000 },
      'claude-sonnet-4-6'
    )
    expect(cost).toBeCloseTo(0.30)
  })
})

describe('loadCustomPricing', () => {
  beforeEach(() => loadCustomPricing({}))  // reset

  it('overrides pricing for a model', () => {
    loadCustomPricing({ 'claude-sonnet-4-6': { inputCostPerMToken: 1, outputCostPerMToken: 5, cacheWriteCostPerMToken: 1.25, cacheReadCostPerMToken: 0.10 } })
    expect(getPricing('claude-sonnet-4-6').inputCostPerMToken).toBe(1)
  })
})
