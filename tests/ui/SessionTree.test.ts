import { describe, it, expect } from 'vitest'
import {
  subAgentsRowWidth,
  projectSubtreeWidth,
  allProjectsWidth,
  branchLine,
} from '../../src/ui/SessionTree.js'
import { agentBoxWidth } from '../../src/ui/AgentNode.js'
import type { SessionState, AgentState } from '../../src/state/types.js'

function makeAgent(name: string, burnRatePerMinute = 0): AgentState {
  return {
    sessionId: 'sess-1',
    agentId: name === 'orch' ? null : name,
    name,
    model: 'claude-sonnet-4-6',
    totals: { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, totalTokens: 0, cost: 0 },
    burnRatePerMinute,
    dangerRatio: 0,
    color: '#58a6ff',
    isSidechain: name !== 'orch',
  }
}

function makeSession(cwd: string, subAgentNames: string[] = []): SessionState {
  return {
    sessionId: 'sess-1',
    cwd,
    startedAt: 0,
    orchestrator: makeAgent('orch'),
    subAgents: subAgentNames.map(makeAgent),
    dangerRatio: 0,
    color: '#58a6ff',
  }
}

describe('subAgentsRowWidth', () => {
  it('retorna 0 si no hay sub-agents', () => {
    expect(subAgentsRowWidth([])).toBe(0)
  })

  it('retorna el ancho de la caja si hay 1 sub-agent', () => {
    const agents = [makeAgent('worker')]
    expect(subAgentsRowWidth(agents)).toBe(agentBoxWidth(agents[0]))
  })

  it('suma anchos + gaps de 4 caracteres entre agentes', () => {
    const agents = [makeAgent('a'), makeAgent('b')]
    const expected = agentBoxWidth(agents[0]) + agentBoxWidth(agents[1]) + 4
    expect(subAgentsRowWidth(agents)).toBe(expected)
  })
})

describe('branchLine', () => {
  it('genera línea con ┌, ┴ centrado, y ┐', () => {
    // totalWidth=10: leftArm=Math.floor(10/2)-1=4, rightArm=10-4-3=3
    // "┌────┴───┐" = 10 chars
    expect(branchLine(10)).toBe('┌────┴───┐')
  })

  it('la longitud total es igual a totalWidth', () => {
    expect(branchLine(20)).toHaveLength(20)
    expect(branchLine(15)).toHaveLength(15)
  })
})

describe('projectSubtreeWidth', () => {
  it('es al menos el ancho del nombre del proyecto + 4', () => {
    const session = makeSession('/Users/carlos/my-project')
    // basename = "my-project" (10 chars) + 4 = 14
    expect(projectSubtreeWidth(session)).toBeGreaterThanOrEqual(14)
  })

  it('crece si el orquestador es más ancho que el nombre del proyecto', () => {
    const session = makeSession('/x/y', [])  // basename "y" = 1 char + 4 = 5
    // orch boxWidth = agentBoxWidth(makeAgent('orch')) = 20
    expect(projectSubtreeWidth(session)).toBeGreaterThanOrEqual(agentBoxWidth(session.orchestrator))
  })
})

describe('allProjectsWidth', () => {
  it('retorna 0 si no hay sesiones', () => {
    expect(allProjectsWidth([])).toBe(0)
  })

  it('retorna el ancho del único proyecto si hay 1 sesión', () => {
    const session = makeSession('/x/proj')
    expect(allProjectsWidth([session])).toBe(projectSubtreeWidth(session))
  })

  it('suma anchos + gaps de 4 entre proyectos', () => {
    const s1 = makeSession('/x/p1')
    const s2 = makeSession('/x/p2')
    expect(allProjectsWidth([s1, s2])).toBe(projectSubtreeWidth(s1) + projectSubtreeWidth(s2) + 4)
  })
})
