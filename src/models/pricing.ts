export interface PricingEntry {
  inputCostPerMToken: number
  outputCostPerMToken: number
  cacheWriteCostPerMToken: number
  cacheReadCostPerMToken: number
}

const DEFAULT_PRICING: Record<string, PricingEntry> = {
  'claude-sonnet-4-6': { inputCostPerMToken: 3.00, outputCostPerMToken: 15.00, cacheWriteCostPerMToken: 3.75, cacheReadCostPerMToken: 0.30 },
  'claude-opus-4-6':   { inputCostPerMToken: 15.00, outputCostPerMToken: 75.00, cacheWriteCostPerMToken: 18.75, cacheReadCostPerMToken: 1.50 },
  'claude-haiku-4-5':  { inputCostPerMToken: 0.80, outputCostPerMToken: 4.00, cacheWriteCostPerMToken: 1.00, cacheReadCostPerMToken: 0.08 },
}

const FALLBACK: PricingEntry = DEFAULT_PRICING['claude-sonnet-4-6']

let _registry = { ...DEFAULT_PRICING }

export function loadCustomPricing(overrides: Record<string, PricingEntry>): void {
  _registry = { ...DEFAULT_PRICING, ...overrides }
}

export function getPricing(modelId: string): PricingEntry {
  return _registry[modelId] ?? FALLBACK
}

export function calculateCost(
  usage: { inputTokens: number; outputTokens: number; cacheWriteTokens: number; cacheReadTokens: number },
  modelId: string
): number {
  const p = getPricing(modelId)
  return (
    usage.inputTokens * p.inputCostPerMToken +
    usage.outputTokens * p.outputCostPerMToken +
    usage.cacheWriteTokens * p.cacheWriteCostPerMToken +
    usage.cacheReadTokens * p.cacheReadCostPerMToken
  ) / 1_000_000
}
