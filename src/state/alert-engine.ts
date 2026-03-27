export function calculateDangerRatio(
  currentTokens: number,
  burnRatePerMinute: number,
  remainingMinutes: number,
  estimatedCeiling: number
): number {
  if (estimatedCeiling <= 0) return 0
  const projected = currentTokens + burnRatePerMinute * remainingMinutes
  return projected / estimatedCeiling
}

export function dangerColor(ratio: number): string {
  if (ratio <= 0.50) return '#3fb950'
  if (ratio <= 0.70) return '#7cc752'
  if (ratio <= 0.85) return '#e3b341'
  if (ratio <= 0.95) return '#f0883e'
  if (ratio <= 1.00) return '#f4603a'
  return '#f85149'
}

export const GRAY = '#484f58'
