import React from 'react'
import * as path from 'node:path'
import * as os from 'node:os'
import { Box, Text } from 'ink'
import type { SessionState, AgentState } from '../state/types.js'
import { AgentNode, agentBoxWidth } from './AgentNode.js'

// ─── Layout utilities (exported for tests) ───────────────────────────────────

export function subAgentsRowWidth(subAgents: AgentState[], gap = 4): number {
  if (subAgents.length === 0) return 0
  return subAgents.reduce((sum, a) => sum + agentBoxWidth(a), 0) + gap * (subAgents.length - 1)
}

export function branchLine(totalWidth: number): string {
  if (totalWidth < 3) return '│'
  const leftArm  = Math.floor(totalWidth / 2) - 1
  const rightArm = totalWidth - leftArm - 3
  return '┌' + '─'.repeat(leftArm) + '┴' + '─'.repeat(rightArm) + '┐'
}

export function projectSubtreeWidth(session: SessionState): number {
  const projectBoxW = path.basename(session.cwd).length + 4
  const subRow      = subAgentsRowWidth(session.subAgents)
  const orchW       = agentBoxWidth(session.orchestrator)
  return Math.max(projectBoxW, subRow, orchW)
}

export function allProjectsWidth(sessions: SessionState[], gap = 4): number {
  if (sessions.length === 0) return 0
  return sessions.reduce((sum, s) => sum + projectSubtreeWidth(s), 0) + gap * (sessions.length - 1)
}

// ─── Components ──────────────────────────────────────────────────────────────

function RootNode({ label, color }: { label: string; color: string }) {
  const inner = ` ${label} `
  const border = '═'.repeat(inner.length)
  const halfLeft = Math.floor(inner.length / 2)
  const bottom = '╚' + '═'.repeat(halfLeft) + '╤' + '═'.repeat(inner.length - halfLeft - 1) + '╝'
  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={color}>{`╔${border}╗`}</Text>
      <Text color={color}>{`║${inner}║`}</Text>
      <Text color={color}>{bottom}</Text>
    </Box>
  )
}

function ProjectNode({ session }: { session: SessionState }) {
  const c = session.color
  const name = path.basename(session.cwd)
  const inner = ` ${name} `
  const border = '═'.repeat(inner.length)
  const halfLeft = Math.floor(inner.length / 2)
  const bottom = '╚' + '═'.repeat(halfLeft) + '╤' + '═'.repeat(inner.length - halfLeft - 1) + '╝'

  const hasSubAgents = session.subAgents.length > 0
  const subRow = subAgentsRowWidth(session.subAgents)

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={c}>{`╔${border}╗`}</Text>
      <Text color={c}>{`║${inner}║`}</Text>
      <Text color={c}>{bottom}</Text>

      {hasSubAgents ? (
        <>
          <Text color={c}>{subRow > 1 ? branchLine(subRow) : '│'}</Text>
          <Box flexDirection="row" gap={4}>
            {session.subAgents.map(agent => (
              <AgentNode key={agent.agentId ?? agent.name} agent={agent} />
            ))}
          </Box>
          <Text color={c}>│</Text>
        </>
      ) : (
        <Text color={c}>│</Text>
      )}

      <AgentNode agent={session.orchestrator} />
    </Box>
  )
}

export function SessionTree({ sessions }: { sessions: SessionState[] }) {
  if (sessions.length === 0) return <Text color="#6e7681">  sin sesiones activas</Text>

  const rootLabel = `${os.userInfo().username}@${os.hostname()}`
  const totalW    = allProjectsWidth(sessions)

  return (
    <Box flexDirection="column" alignItems="center">
      <RootNode label={rootLabel} color="#58a6ff" />
      <Text color="#58a6ff">│</Text>

      {sessions.length > 1 && (
        <Text color="#58a6ff">{branchLine(totalW)}</Text>
      )}

      <Box flexDirection="row" gap={4} alignItems="flex-start">
        {sessions.map(session => (
          <ProjectNode key={session.sessionId} session={session} />
        ))}
      </Box>
    </Box>
  )
}
