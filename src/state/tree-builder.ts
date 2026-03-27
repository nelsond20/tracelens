import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { SessionEvent, WindowState } from '../providers/types.js'
import type { AgentState, SessionState, AppState, TokenTotals } from './types.js'
import { TokenAccumulator } from './accumulator.js'
import { BurnTracker } from './burn-tracker.js'
import { calculateDangerRatio, dangerColor, GRAY } from './alert-engine.js'

export interface SubAgentPath {
  agentId: string
  name: string
  filePath: string
}

export interface SessionDiscovery {
  sessionId: string
  cwd: string
  startedAt: number
  jsonlPath: string
  subAgentPaths: SubAgentPath[]
}

export function extractAgentName(filename: string): string {
  const withoutExt = filename.replace('.jsonl', '')
  const withoutPrefix = withoutExt.replace(/^agent-/, '')
  const withoutHash = withoutPrefix.replace(/-[0-9a-f]{16,}$/, '')
  return withoutHash || withoutPrefix
}

export function cwdToProjectDirHash(cwd: string): string {
  return cwd.replace(/\//g, '-')
}

export function buildAgentKey(sessionId: string, agentId: string | null): string {
  return `${sessionId}:${agentId ?? '__orch__'}`
}

export function discoverSessions(
  activeSessions: SessionEvent[],
  claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects')
): SessionDiscovery[] {
  return activeSessions.map(session => {
    const projectHash = cwdToProjectDirHash(session.cwd)
    const projectPath = path.join(claudeProjectsDir, projectHash)
    const jsonlPath = path.join(projectPath, `${session.sessionId}.jsonl`)
    const subAgentsDir = path.join(projectPath, session.sessionId, 'subagents')

    let subAgentPaths: SubAgentPath[] = []
    if (fs.existsSync(subAgentsDir)) {
      subAgentPaths = fs.readdirSync(subAgentsDir)
        .filter((f: string) => f.endsWith('.jsonl'))
        .map((f: string) => ({
          agentId: f.replace(/^agent-/, '').replace('.jsonl', ''),
          name: extractAgentName(f),
          filePath: path.join(subAgentsDir, f),
        }))
    }

    return { sessionId: session.sessionId, cwd: session.cwd, startedAt: session.startedAt, jsonlPath, subAgentPaths }
  })
}

function emptyTotals(): TokenTotals {
  return { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, totalTokens: 0, cost: 0 }
}

export function buildAppState(
  sessions: SessionEvent[],
  accumulator: TokenAccumulator,
  burnTracker: BurnTracker,
  window: WindowState | null,
  claudeProjectsDir?: string,
  showInactive = false
): AppState {
  const now = Date.now()
  const remainingMinutes = window ? Math.max(0, (window.windowEnd - now / 1000) / 60) : 0
  const ceiling = window?.estimatedCeiling ?? 0

  const discoveries = discoverSessions(sessions, claudeProjectsDir)

  const sessionStates: SessionState[] = discoveries.map(d => {
    const orchKey = buildAgentKey(d.sessionId, null)
    const orchTotals = accumulator.getTotals(d.sessionId, null)
    const orchBurn = burnTracker.getBurnRate(orchKey, now)
    const orchDanger = ceiling > 0 ? calculateDangerRatio(orchTotals.totalTokens, orchBurn, remainingMinutes, ceiling) : 0

    const subAgents: AgentState[] = d.subAgentPaths.map(sa => {
      const key = buildAgentKey(d.sessionId, sa.agentId)
      const totals = accumulator.getTotals(d.sessionId, sa.agentId)
      const burn = burnTracker.getBurnRate(key, now)
      const danger = ceiling > 0 ? calculateDangerRatio(totals.totalTokens, burn, remainingMinutes, ceiling) : 0
      return {
        sessionId: d.sessionId,
        agentId: sa.agentId,
        name: sa.name,
        model: accumulator.getLastModel(d.sessionId, sa.agentId),
        totals,
        burnRatePerMinute: burn,
        dangerRatio: danger,
        color: dangerColor(danger),
        isSidechain: true,
      }
    })

    const sessionDanger = subAgents.length > 0
      ? Math.max(...subAgents.map(a => a.dangerRatio))
      : orchDanger

    const sessionColor = subAgents.length === 0 && ceiling === 0
      ? GRAY
      : dangerColor(sessionDanger)

    const orchestrator: AgentState = {
      sessionId: d.sessionId,
      agentId: null,
      name: 'orquestador',
      model: accumulator.getLastModel(d.sessionId, null),
      totals: orchTotals,
      burnRatePerMinute: orchBurn,
      dangerRatio: orchDanger,
      color: dangerColor(orchDanger),
      isSidechain: false,
    }

    return {
      sessionId: d.sessionId,
      cwd: d.cwd,
      startedAt: d.startedAt,
      orchestrator,
      subAgents,
      dangerRatio: sessionDanger,
      color: sessionColor,
    }
  })

  const visible = showInactive
    ? sessionStates
    : sessionStates.filter(s =>
        s.orchestrator.burnRatePerMinute > 0 ||
        s.subAgents.some(a => a.burnRatePerMinute > 0)
      )

  const totalCost = visible.reduce((sum, s) => {
    return sum + s.orchestrator.totals.cost + s.subAgents.reduce((a, sa) => a + sa.totals.cost, 0)
  }, 0)

  return { sessions: visible, window, totalCost, lastUpdated: now }
}
