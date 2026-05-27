'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ActiveRun } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ACTIVE_STATUSES = new Set(['QUEUED', 'RUNNING'])

export function useActiveRuns() {
  const queryClient = useQueryClient()

  const { data: runs = [] } = useQuery({
    queryKey: ['runs', 'active'],
    queryFn: () => api.get<ActiveRun[]>('/runs/active'),
  })

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/runs/stream`, { withCredentials: true })

    es.addEventListener('run', (e) => {
      const run = JSON.parse(e.data) as ActiveRun
      queryClient.setQueryData<ActiveRun[]>(['runs', 'active'], (prev = []) => {
        if (ACTIVE_STATUSES.has(run.status)) {
          const idx = prev.findIndex((r) => r.id === run.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = run
            return next
          }
          return [run, ...prev]
        }
        queryClient.invalidateQueries({ queryKey: ['test'] })
        return prev.filter((r) => r.id !== run.id)
      })
    })

    es.onerror = () => {
      queryClient.invalidateQueries({ queryKey: ['runs', 'active'] })
    }

    return () => es.close()
  }, [queryClient])

  return runs
}
