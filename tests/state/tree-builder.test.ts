import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractAgentName, cwdToProjectDirHash, buildAgentKey,
  discoverSessions, buildAppState
} from '../../src/state/tree-builder.js'
import { TokenAccumulator } from '../../src/state/accumulator.js'
import { BurnTracker } from '../../src/state/burn-tracker.js'
import * as fs from 'node:fs'

vi.mock('node:fs')

describe('extractAgentName', () => {
  it('strips agent- prefix and hex hash', () => {
    expect(extractAgentName('agent-aside_q-a1b2c3d4e5f6a7b8.jsonl')).toBe('aside_q')
  })

  it('handles names without hash', () => {
    expect(extractAgentName('agent-myagent.jsonl')).toBe('myagent')
  })
})

describe('cwdToProjectDirHash', () => {
  it('replaces slashes with dashes', () => {
    expect(cwdToProjectDirHash('/Users/foo/bar')).toBe('-Users-foo-bar')
  })
})

describe('buildAgentKey', () => {
  it('returns sessionId:agentId for sub-agent', () => {
    expect(buildAgentKey('sess-1', 'agent-abc')).toBe('sess-1:agent-abc')
  })

  it('returns sessionId:__orch__ for orchestrator', () => {
    expect(buildAgentKey('sess-1', null)).toBe('sess-1:__orch__')
  })
})

describe('discoverSessions', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
  })

  it('returns empty sub-agents when subagents dir does not exist', () => {
    const sessions = [{ sessionId: 'sess-1', pid: 123, cwd: '/Users/foo/proj', startedAt: 0, kind: 'interactive', active: true }]
    const result = discoverSessions(sessions, '/fake/projects')
    expect(result[0].subAgentPaths).toHaveLength(0)
  })
})

describe('buildAppState filtering', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
  })

  it('excluye sesiones sin actividad por defecto', () => {
    const sessions = [
      { sessionId: 'active', pid: 1, cwd: '/proj/a', startedAt: 0, kind: 'interactive' as const, active: true },
      { sessionId: 'idle',   pid: 2, cwd: '/proj/b', startedAt: 0, kind: 'interactive' as const, active: true },
    ]
    const acc = new TokenAccumulator()
    const burn = new BurnTracker()
    burn.recordTokens('active:__orch__', 500)

    const state = buildAppState(sessions, acc, burn, null, '/fake/projects')

    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].sessionId).toBe('active')
  })

  it('muestra todas las sesiones cuando showInactive es true', () => {
    const sessions = [
      { sessionId: 'active', pid: 1, cwd: '/proj/a', startedAt: 0, kind: 'interactive' as const, active: true },
      { sessionId: 'idle',   pid: 2, cwd: '/proj/b', startedAt: 0, kind: 'interactive' as const, active: true },
    ]
    const acc = new TokenAccumulator()
    const burn = new BurnTracker()
    burn.recordTokens('active:__orch__', 500)

    const state = buildAppState(sessions, acc, burn, null, '/fake/projects', true)

    expect(state.sessions).toHaveLength(2)
    expect(state.sessions.map(s => s.sessionId)).toContain('idle')
  })

  it('incluye sesión cuando solo un sub-agente tiene actividad', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    // agentId = filename sin prefijo "agent-" y sin ".jsonl" (el hash se conserva en agentId, no se elimina)
    vi.mocked(fs.readdirSync).mockReturnValue(['agent-worker-abc123def456789a.jsonl'] as any)

    const sessions = [
      { sessionId: 'sess-1', pid: 1, cwd: '/proj/a', startedAt: 0, kind: 'interactive' as const, active: true },
    ]
    const acc = new TokenAccumulator()
    const burn = new BurnTracker()
    burn.recordTokens('sess-1:worker-abc123def456789a', 500)

    const state = buildAppState(sessions, acc, burn, null, '/fake/projects')

    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].sessionId).toBe('sess-1')
  })
})
