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

function readAgentMetaName(metaPath: string): string | null {
  try {
    const raw = fs.readFileSync(metaPath, 'utf8')
    const meta = JSON.parse(raw as string)
    if (meta.description) return meta.description as string
    if (meta.agentType) {
      const t = meta.agentType as string
      const colonIdx = t.lastIndexOf(':')
      return colonIdx >= 0 ? t.slice(colonIdx + 1) : t
    }
  } catch { /* fallback al nombre del archivo */ }
  return null
}

export function cwdToProjectDirHash(cwd: string): string {
  return cwd.replace(/\//g, '-')
}

export function buildAgentKey(sessionId: string, agentId: string | null): string {
  return `${sessionId}:${agentId ?? '__orch__'}`
}

function findMostRecentJsonl(projectPath: string): string | null {
  if (!fs.existsSync(projectPath)) return null
  try {
    let mostRecent: string | null = null
    let mostRecentMtime = 0
    for (const f of fs.readdirSync(projectPath) as string[]) {
      if (!f.endsWith('.jsonl')) continue
      const filePath = path.join(projectPath, f)
      try {
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs > mostRecentMtime) {
          mostRecentMtime = stat.mtimeMs
          mostRecent = filePath
        }
      } catch { /* skip */ }
    }
    return mostRecent
  } catch { return null }
}

function extractSessionIdFromJsonl(jsonlPath: string): string | null {
  try {
    const fd = fs.openSync(jsonlPath, 'r')
    const buf = Buffer.allocUnsafe(4096)
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0)
    fs.closeSync(fd)
    const lines = buf.subarray(0, bytesRead).toString('utf8').split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line) as Record<string, unknown>
        if (entry['sessionId']) return entry['sessionId'] as string
      } catch { /* skip malformed line */ }
    }
    return null
  } catch { return null }
}

export function discoverSessions(
  activeSessions: SessionEvent[],
  claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects')
): SessionDiscovery[] {
  return activeSessions.map(session => {
    const projectHash = cwdToProjectDirHash(session.cwd)
    const projectPath = path.join(claudeProjectsDir, projectHash)

    // /clear crea un nuevo sessionId pero no actualiza ~/.claude/sessions/.
    // Usar el JSONL más reciente del directorio para reflejar la conversación activa.
    const mostRecentJsonl = findMostRecentJsonl(projectPath)
    const actualSessionId = mostRecentJsonl
      ? (extractSessionIdFromJsonl(mostRecentJsonl) ?? session.sessionId)
      : session.sessionId
    const jsonlPath = mostRecentJsonl ?? path.join(projectPath, `${session.sessionId}.jsonl`)
    const subAgentsDir = path.join(projectPath, actualSessionId, 'subagents')

    let subAgentPaths: SubAgentPath[] = []
    if (fs.existsSync(subAgentsDir)) {
      subAgentPaths = fs.readdirSync(subAgentsDir)
        .filter((f: string) => f.endsWith('.jsonl'))
        .map((f: string) => {
          const metaPath = path.join(subAgentsDir, f.replace('.jsonl', '.meta.json'))
          const metaName = fs.existsSync(metaPath) ? readAgentMetaName(metaPath) : null
          return {
            agentId: f.replace(/^agent-/, '').replace('.jsonl', ''),
            name: metaName ?? extractAgentName(f),
            filePath: path.join(subAgentsDir, f),
          }
        })
    }

    return { sessionId: actualSessionId, cwd: session.cwd, startedAt: session.startedAt, jsonlPath, subAgentPaths }
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
  claudeProjectsDir?: string
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

    const subAgents: AgentState[] = d.subAgentPaths
      .map(sa => {
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
      .filter(sa => sa.burnRatePerMinute > 0)

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

  const visible = sessionStates

  const totalCost = visible.reduce((sum, s) => {
    return sum + s.orchestrator.totals.cost + s.subAgents.reduce((a, sa) => a + sa.totals.cost, 0)
  }, 0)

  return { sessions: visible, window, totalCost, lastUpdated: now }
}
