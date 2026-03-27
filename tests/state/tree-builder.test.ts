import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractAgentName, cwdToProjectDirHash, buildAgentKey, discoverSessions } from '../../src/state/tree-builder.js'
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
