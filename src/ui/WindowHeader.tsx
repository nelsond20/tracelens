import React from 'react'
import { Box, Text } from 'ink'
import type { AppState } from '../state/types.js'

function formatReset(windowEnd: number): string {
  const remaining = Math.max(0, windowEnd - Date.now() / 1000)
  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`
}

export function WindowHeader({ state }: { state: AppState }) {
  const w = state.window

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={2}>
        <Text bold color="#e6edf3">TRACELENS</Text>
        <Text color="#6e7681">│</Text>
        {w ? (
          <>
            <Text>5h: <Text color="#3fb950">{Math.round((state.sessions.reduce((s, sess) => s + sess.orchestrator.totals.totalTokens + sess.subAgents.reduce((a, sa) => a + sa.totals.totalTokens, 0), 0) / w.estimatedCeiling) * 100)}% [{w.ceilingLevel}]</Text></Text>
            <Text color="#6e7681">│</Text>
            <Text>Ceiling: <Text color="#3fb950">{(w.estimatedCeiling / 1_000_000).toFixed(1)}M</Text></Text>
            <Text color="#6e7681">│</Text>
            <Text>Reset: <Text color="#e3b341">{formatReset(w.windowEnd)}</Text></Text>
          </>
        ) : (
          <Text color="#6e7681">sin datos de ventana 5h</Text>
        )}
        <Text color="#6e7681">│</Text>
        <Text color="#6e7681">Total: {formatCost(state.totalCost)}</Text>
      </Box>
      <Text color="#21262d">{'─'.repeat(76)}</Text>
    </Box>
  )
}
