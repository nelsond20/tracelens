import React from 'react'
import { Box, Text } from 'ink'
import type { AgentState } from '../state/types.js'

interface Props {
  agent: AgentState
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`
}

function formatBurn(tokPerMin: number): string {
  if (tokPerMin === 0) return ''
  return ` · burn ${formatTokens(tokPerMin)}/min`
}

export function agentInnerWidth(agent: AgentState): number {
  const warn = agent.dangerRatio > 1.0 ? ' ⚠' : ''
  const nameLine  = ` ${agent.name}${warn}`
  const modelLine = ` ${agent.model}`
  const tokLine   = ` ${formatTokens(agent.totals.totalTokens)} tok · ${formatCost(agent.totals.cost)}${formatBurn(agent.burnRatePerMinute)}`
  return Math.max(nameLine.length, modelLine.length, tokLine.length)
}

export function agentBoxWidth(agent: AgentState): number {
  return agentInnerWidth(agent) + 2
}

export function AgentNode({ agent }: Props) {
  const c = agent.color
  const w = agentInnerWidth(agent)
  const border = '═'.repeat(w)
  const line = (s: string) => s.slice(0, w).padEnd(w)

  const warn = agent.dangerRatio > 1.0 ? ' ⚠' : ''
  const nameLine  = line(` ${agent.name}${warn}`)
  const modelLine = line(` ${agent.model}`)
  const tokLine   = line(` ${formatTokens(agent.totals.totalTokens)} tok · ${formatCost(agent.totals.cost)}${formatBurn(agent.burnRatePerMinute)}`)

  return (
    <Box flexDirection="column">
      <Text color={c}>{`╔${border}╗`}</Text>
      <Text color={c}>{'║'}<Text color={agent.dangerRatio > 0.95 ? c : '#e6edf3'}>{nameLine}</Text><Text color={c}>{'║'}</Text></Text>
      <Text color={c}>{'║'}<Text color="#6e7681">{modelLine}</Text><Text color={c}>{'║'}</Text></Text>
      <Text color={c}>{'║'}<Text color={c}>{tokLine}</Text><Text color={c}>{'║'}</Text></Text>
      <Text color={c}>{`╚${border}╝`}</Text>
    </Box>
  )
}
