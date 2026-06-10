'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { BrowserTab } from '@/lib/types'

export type SessionState = 'idle' | 'starting' | 'warming' | 'ready'

export function useAuthorSession(testId: string) {
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [statusLabel, setStatusLabel] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  async function ensureSession(onReady?: (sessionId: string, initialTabs: BrowserTab[]) => void) {
    if (sessionState !== 'idle') return
    setSessionState('starting')
    setStatusLabel('Launching browser…')
    try {
      const data = await api.post<{ sessionId: string }>(`/tests/${testId}/author`)
      setSessionId(data.sessionId)
      sessionIdRef.current = data.sessionId
      setSessionState('ready')
      setStatusLabel('')
      const tabsData = await api.get<{ tabs: BrowserTab[] }>(`/author/${data.sessionId}/tabs`).catch(() => ({ tabs: [] }))
      onReady?.(data.sessionId, tabsData.tabs)
    } catch {
      setSessionState('idle')
      setStatusLabel('')
    }
  }

  async function closeSession() {
    const sid = sessionIdRef.current
    if (!sid) return
    await api.delete(`/author/${sid}`).catch(() => {})
    sessionIdRef.current = null
    setSessionId(null)
    setSessionState('idle')
  }

  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        api.delete(`/author/${sessionIdRef.current}`).catch(() => {})
        sessionIdRef.current = null
      }
    }
  }, [testId])

  return {
    sessionState,
    setSessionState,
    statusLabel,
    setStatusLabel,
    sessionId,
    setSessionId,
    sessionIdRef,
    ensureSession,
    closeSession,
  }
}
