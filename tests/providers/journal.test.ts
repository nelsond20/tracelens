import { describe, it, expect } from 'vitest'
import { extractToolEvent } from '../../src/providers/journal.js'

function makeEntry(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'assistant',
    sessionId: 'sess-1',
    agentId: null,
    ...overrides,
  }
}

describe('extractToolEvent', () => {
  it('returns null for non-assistant entries', () => {
    const entry = makeEntry({ type: 'user' })
    expect(extractToolEvent(entry)).toBeNull()
  })

  it('returns null for streaming chunks (stop_reason: null)', () => {
    const entry = makeEntry({
      message: { stop_reason: null, content: [] },
    })
    expect(extractToolEvent(entry)).toBeNull()
  })

  it('extracts tools from stop_reason: tool_use', () => {
    const entry = makeEntry({
      message: {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', name: 'Read', id: 'x' },
          { type: 'tool_use', name: 'Read', id: 'y' },
          { type: 'tool_use', name: 'Bash', id: 'z' },
        ],
      },
    })
    const result = extractToolEvent(entry)
    expect(result).toEqual({ sessionId: 'sess-1', agentId: null, tools: { Read: 2, Bash: 1 } })
  })

  it('returns null for tool_use entry with no tool_use blocks', () => {
    const entry = makeEntry({
      message: {
        stop_reason: 'tool_use',
        content: [{ type: 'text', text: 'hola' }],
      },
    })
    expect(extractToolEvent(entry)).toBeNull()
  })

  it('returns clear signal for stop_reason: end_turn', () => {
    const entry = makeEntry({
      message: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }] },
    })
    const result = extractToolEvent(entry)
    expect(result).toEqual({ sessionId: 'sess-1', agentId: null, tools: null })
  })

  it('preserves agentId', () => {
    const entry = makeEntry({
      agentId: 'worker-abc',
      message: { stop_reason: 'end_turn', content: [] },
    })
    const result = extractToolEvent(entry)
    expect(result?.agentId).toBe('worker-abc')
  })
})
