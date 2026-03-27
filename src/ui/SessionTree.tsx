import React from 'react'
import { Box, Text } from 'ink'
import type { SessionState } from '../state/types.js'
import { AgentNode } from './AgentNode.js'

function SubBranch({ sessions }: { sessions: SessionState[] }) {
  return (
    <Box flexDirection="row" gap={4} alignItems="flex-start">
      {sessions.map(session => (
        <Box key={session.sessionId} flexDirection="column" alignItems="center">
          {/* Sub-agentes arriba */}
          {session.subAgents.length > 0 && (
            <Box flexDirection="row" gap={2} marginBottom={0}>
              {session.subAgents.map(agent => (
                <AgentNode key={agent.agentId} agent={agent} isSubAgent />
              ))}
            </Box>
          )}
          {/* Línea vertical desde agentes al orquestador */}
          <Text color={session.color}>│</Text>
          {/* Orquestador */}
          <AgentNode agent={session.orchestrator} />
          {/* Línea hacia el tronco */}
          <Text color={session.color}>│</Text>
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
      {/* Raíz */}
      <Text color="#58a6ff">╔════════════════════╗</Text>
      <Text color="#58a6ff">║ ~/.claude/projects ║</Text>
      <Text color="#58a6ff">╚══════════╤═════════╝</Text>
      <Text color="#58a6ff">│</Text>

      {/* Rama horizontal */}
      <Box flexDirection="row">
        <Text color={leftHalf[leftHalf.length - 1]?.color ?? '#484f58'}>
          {'┌' + '─'.repeat(21)}
        </Text>
        <Text color="#58a6ff">┴</Text>
        <Text color={rightHalf[0]?.color ?? '#484f58'}>
          {'─'.repeat(21) + '┐'}
        </Text>
      </Box>

      {/* Sesiones */}
      <SubBranch sessions={sessions} />
    </Box>
  )
}
