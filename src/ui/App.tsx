import React, { useState, useEffect, useRef } from 'react'
import { Box } from 'ink'
import { SessionProvider } from '../providers/session.js'
import { JournalProvider } from '../providers/journal.js'
import { WindowProvider } from '../providers/window.js'
import { TokenAccumulator } from '../state/accumulator.js'
import { BurnTracker } from '../state/burn-tracker.js'
import { buildAppState, buildAgentKey, discoverSessions } from '../state/tree-builder.js'
import { WindowHeader } from './WindowHeader.js'
import { SessionTree } from './SessionTree.js'
import type { AppState } from '../state/types.js'
import type { SessionEvent, JournalEvent, WindowState } from '../providers/types.js'

interface Props {
  claudeProjectsDir?: string
  projectFilter?: (cwd: string) => boolean
}

const EMPTY_STATE: AppState = { sessions: [], window: null, totalCost: 0, lastUpdated: 0 }

export function App({ claudeProjectsDir, projectFilter }: Props) {
  const [appState, setAppState] = useState<AppState>(EMPTY_STATE)

  const accRef = useRef(new TokenAccumulator())
  const burnRef = useRef(new BurnTracker())
  const sessionsRef = useRef<SessionEvent[]>([])
  const windowRef = useRef<WindowState | null>(null)

  useEffect(() => {
    const acc = accRef.current
    const burn = burnRef.current

    const sessionProv = new SessionProvider()
    const journalProv = new JournalProvider()
    const windowProv = new WindowProvider()

    sessionProv.on('data', (event: SessionEvent) => {
      if (event.active && (!projectFilter || projectFilter(event.cwd))) {
        sessionsRef.current = [...sessionsRef.current.filter(s => s.sessionId !== event.sessionId), event]
      } else {
        sessionsRef.current = sessionsRef.current.filter(s => s.sessionId !== event.sessionId)
      }
      const discoveries = discoverSessions(sessionsRef.current, claudeProjectsDir)
      const allPaths = discoveries.flatMap(d => [d.jsonlPath, ...d.subAgentPaths.map(sa => sa.filePath)])
      journalProv.setWatchPaths(allPaths)
    })

    windowProv.on('data', (state: WindowState) => {
      windowRef.current = state
      acc.setWindowStart(state.windowStart)
      journalProv.setWindowStart(state.windowStart)
    })

    journalProv.on('data', (event: JournalEvent) => {
      acc.addEntry(event)
      const key = buildAgentKey(event.sessionId, event.agentId)
      const total = event.usage.inputTokens + event.usage.outputTokens +
        event.usage.cacheCreationInputTokens + event.usage.cacheReadInputTokens
      burn.recordTokens(key, total, new Date(event.timestamp).getTime())
    })

    const renderInterval = setInterval(() => {
      setAppState(buildAppState(sessionsRef.current, acc, burn, windowRef.current, claudeProjectsDir))
    }, 300)

    sessionProv.start()
    journalProv.start()
    windowProv.start()

    return () => {
      clearInterval(renderInterval)
      sessionProv.stop()
      journalProv.stop()
      windowProv.stop()
    }
  }, [claudeProjectsDir])

  return (
    <Box flexDirection="column" padding={1}>
      <WindowHeader state={appState} />
      <SessionTree sessions={appState.sessions} />
    </Box>
  )
}
