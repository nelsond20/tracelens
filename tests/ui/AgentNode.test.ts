import { describe, it, expect } from 'vitest'
import { agentInnerWidth, agentBoxWidth } from '../../src/ui/AgentNode.js'
import type { AgentState } from '../../src/state/types.js'

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    sessionId: 'sess-1',
    agentId: null,
    name: 'orquestador',
    model: 'claude-sonnet-4-6',
    totals: { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, totalTokens: 0, cost: 0 },
    burnRatePerMinute: 0,
    dangerRatio: 0,
    color: '#58a6ff',
    isSidechain: false,
    currentTools: null,
    ...overrides,
  }
}

describe('agentInnerWidth', () => {
  it('nombre corto, sin burn → ancho mínimo dado por tok line', () => {
    const agent = makeAgent({ name: 'orch', model: 'claude-sonnet-4-6' })
    // tok line: " 0 tok · $0.00" = 15 chars
    // model line: " claude-sonnet-4-6" = 18 chars
    // name line: " orch" = 5 chars
    expect(agentInnerWidth(agent)).toBe(18)
  })

  it('burn rate largo domina el ancho', () => {
    const agent = makeAgent({ burnRatePerMinute: 1_100_000 })
    // tok line: " 0 tok · $0.00 · burn 1.1M/min" = 30 chars
    expect(agentInnerWidth(agent)).toBe(30)
  })

  it('nombre con ⚠ largo domina el ancho', () => {
    const agent = makeAgent({ name: 'un-nombre-muy-largo-aqui', dangerRatio: 1.1 })
    // name line: " un-nombre-muy-largo-aqui ⚠" = 27 chars
    expect(agentInnerWidth(agent)).toBeGreaterThanOrEqual(27)
  })

  it('incluye el ancho de las tool lines cuando currentTools no es null', () => {
    // "  Read(10) · Bash(5) · Glob(3) · Write(2)" = 41 chars
    const agent = makeAgent({ currentTools: { Read: 10, Bash: 5, Glob: 3, Write: 2 } })
    expect(agentInnerWidth(agent)).toBeGreaterThanOrEqual(41)
  })

  it('no cambia el ancho cuando currentTools es null', () => {
    const agent = makeAgent({ currentTools: null })
    // igual que sin tools: dominado por model line (18 chars)
    expect(agentInnerWidth(agent)).toBe(18)
  })
})

describe('agentBoxWidth', () => {
  it('es agentInnerWidth + 2 (los bordes ║)', () => {
    const agent = makeAgent()
    expect(agentBoxWidth(agent)).toBe(agentInnerWidth(agent) + 2)
  })
})
