import { describe, it, expect, beforeEach } from 'vitest'
import { ToolTracker } from '../../src/state/tool-tracker.js'

describe('ToolTracker', () => {
  let tracker: ToolTracker

  beforeEach(() => { tracker = new ToolTracker() })

  it('returns null when no tools recorded', () => {
    expect(tracker.getTools('agent-1')).toBeNull()
  })

  it('records tool counts', () => {
    tracker.recordTools('agent-1', { Read: 2, Bash: 1 })
    expect(tracker.getTools('agent-1')).toEqual({ Read: 2, Bash: 1 })
  })

  it('accumulates tool counts across multiple calls', () => {
    tracker.recordTools('agent-1', { Read: 2 })
    tracker.recordTools('agent-1', { Read: 1, Bash: 1 })
    expect(tracker.getTools('agent-1')).toEqual({ Read: 3, Bash: 1 })
  })

  it('clears tools for agent', () => {
    tracker.recordTools('agent-1', { Read: 3 })
    tracker.clearTools('agent-1')
    expect(tracker.getTools('agent-1')).toBeNull()
  })

  it('tracks different agents independently', () => {
    tracker.recordTools('agent-1', { Read: 2 })
    tracker.recordTools('agent-2', { Bash: 1 })
    expect(tracker.getTools('agent-1')).toEqual({ Read: 2 })
    expect(tracker.getTools('agent-2')).toEqual({ Bash: 1 })
  })

  it('clearing one agent does not affect others', () => {
    tracker.recordTools('agent-1', { Read: 2 })
    tracker.recordTools('agent-2', { Bash: 1 })
    tracker.clearTools('agent-1')
    expect(tracker.getTools('agent-2')).toEqual({ Bash: 1 })
  })
})
