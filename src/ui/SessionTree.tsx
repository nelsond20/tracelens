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
  const projectBoxW = path.basename(session.cwd).length + 4  // " name " + ║║
  const subRow      = subAgentsRowWidth(session.subAgents)
  const orchW       = agentBoxWidth(session.orchestrator)
  return Math.max(projectBoxW, subRow, orchW)
}

export function allProjectsWidth(sessions: SessionState[], gap = 4): number {
  if (sessions.length === 0) return 0
  return sessions.reduce((sum, s) => sum + projectSubtreeWidth(s), 0) + gap * (sessions.length - 1)
}

// ─── Components (sin cambios) ─────────────────────────────────────────────────

function SubBranch({ sessions }: { sessions: SessionState[] }) {
  return (
    <Box flexDirection="row" gap={4} alignItems="flex-start">
      {sessions.map(session => (
        <Box key={session.sessionId} flexDirection="column" alignItems="center">
          {session.subAgents.length > 0 && (
            <Box flexDirection="row" gap={2} marginBottom={0}>
              {session.subAgents.map(agent => (
                <AgentNode key={agent.agentId} agent={agent} />
              ))}
            </Box>
          )}
          <Text color={session.color}>│</Text>
          <AgentNode agent={session.orchestrator} />
          <Text color={session.color}>{path.basename(session.cwd)}</Text>
        </Box>
      ))}
    </Box>
  )
}

export function SessionTree({ sessions }: { sessions: SessionState[] }) {
  if (sessions.length === 0) return <Text color="#6e7681">  sin sesiones activas</Text>

  const halfLeft = Math.ceil(sessions.length / 2)
  const leftHalf = sessions.slice(0, halfLeft)
  const rightHalf = sessions.slice(halfLeft)

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color="#58a6ff">╔════════════════════╗</Text>
      <Text color="#58a6ff">║ ~/.claude/projects ║</Text>
      <Text color="#58a6ff">╚══════════╤═════════╝</Text>
      <Text color="#58a6ff">│</Text>
      <Box flexDirection="row">
        <Text color={leftHalf[leftHalf.length - 1]?.color ?? '#484f58'}>
          {'┌' + '─'.repeat(21)}
        </Text>
        <Text color="#58a6ff">┴</Text>
        <Text color={rightHalf[0]?.color ?? '#484f58'}>
          {'─'.repeat(21) + '┐'}
        </Text>
      </Box>
      <SubBranch sessions={sessions} />
    </Box>
  )
}
