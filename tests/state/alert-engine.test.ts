import { describe, it, expect } from 'vitest'
import { calculateDangerRatio, dangerColor } from '../../src/state/alert-engine.js'

describe('calculateDangerRatio', () => {
  it('returns 0 when ceiling is 0', () => {
    expect(calculateDangerRatio(500_000, 1000, 60, 0)).toBe(0)
  })

  it('projects future usage: current + burn × remaining', () => {
    // 1M tokens, 10k/min burn, 100 min left → projected = 2M, ceiling = 4M → 0.5
    expect(calculateDangerRatio(1_000_000, 10_000, 100, 4_000_000)).toBeCloseTo(0.5)
  })

  it('exceeds 1.0 when projection surpasses ceiling', () => {
    // 3M tokens, 50k/min burn, 60 min left → projected = 6M, ceiling = 4M → 1.5
    expect(calculateDangerRatio(3_000_000, 50_000, 60, 4_000_000)).toBeCloseTo(1.5)
  })
})

describe('dangerColor', () => {
  it('maps thresholds to correct hex colors', () => {
    expect(dangerColor(0.0)).toBe('#3fb950')   // verde
    expect(dangerColor(0.49)).toBe('#3fb950')
    expect(dangerColor(0.51)).toBe('#7cc752')  // amarillo-verde
    expect(dangerColor(0.71)).toBe('#e3b341')  // amarillo
    expect(dangerColor(0.86)).toBe('#f0883e')  // naranja
    expect(dangerColor(0.96)).toBe('#f4603a')  // naranja-rojizo
    expect(dangerColor(1.01)).toBe('#f85149')  // rojo
  })
})
