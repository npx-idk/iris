'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/lib/auth-client'
import { api } from '@/lib/api'
import type { Project } from '@/lib/types'

const STORAGE_KEY = 'iris-active-project'

export function useActiveProject() {
  const { data: session } = useSession()
  const [activeId, setActiveIdState] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setActiveIdState(stored)
  }, [])

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!session,
  })

  // Auto-select first project if stored ID is invalid or missing
  useEffect(() => {
    if (!projects.length) return
    const isValid = !!activeId && projects.some(p => p.id === activeId)
    if (!isValid) {
      const id = projects[0]!.id
      setActiveIdState(id)
      localStorage.setItem(STORAGE_KEY, id)
    }
  }, [projects, activeId])

  function setActiveProject(id: string) {
    setActiveIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const activeProject = projects.find(p => p.id === activeId) ?? projects[0] ?? null

  return { activeProject, projects, setActiveProject }
}
