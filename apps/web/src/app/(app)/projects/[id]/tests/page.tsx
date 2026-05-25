'use client'

import { useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { Test, RunStatus } from '@/lib/types'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Separator } from '@workspace/ui/components/separator'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'

export default function TestsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const [dragging, setDragging] = useState<string | null>(null)
  const [localTests, setLocalTests] = useState<Test[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const { data: fetchedTests = [], isLoading, refetch } = useQuery({
    queryKey: ['tests', projectId],
    queryFn: () => api.get<Test[]>(`/projects/${projectId}/tests`),
  })

  const tests = localTests ?? fetchedTests

  const handleDragStart = useCallback((id: string) => setDragging(id), [])

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragging || dragging === targetId) return
    setLocalTests((prev) => {
      const source = prev ?? fetchedTests
      const from = source.findIndex((t) => t.id === dragging)
      const to = source.findIndex((t) => t.id === targetId)
      if (from === -1 || to === -1) return source
      const next = [...source]
      const moved = next.splice(from, 1)[0]
      if (!moved) return source
      next.splice(to, 0, moved)
      return next.map((t, i) => ({ ...t, order: i }))
    })
  }, [dragging, fetchedTests])

  const handleDragEnd = useCallback(async () => {
    setDragging(null)
    if (!localTests) return
    await api.patch(`/projects/${projectId}/tests/reorder`, {
      tests: localTests.map((t) => ({ id: t.id, order: t.order })),
    })
    setLocalTests(null)
    refetch()
  }, [localTests, projectId, refetch])

  async function handleExport() {
    const data = await api.get(`/projects/${projectId}/export`)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `iris-suite-${projectId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const payload = json.tests ? { tests: json.tests } : json
      await api.post(`/projects/${projectId}/import`, payload)
      refetch()
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(testId: string) {
    setDeleting(true)
    try {
      await api.delete(`/tests/${testId}`)
      setConfirmDeleteId(null)
      refetch()
    } finally {
      setDeleting(false)
    }
  }

  const lastRunStatus = (test: Test): RunStatus | undefined =>
    test.runs?.[0]?.status as RunStatus | undefined

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href={ROUTES.dashboard} className="hover:text-foreground transition-colors">
            Projects
          </Link>
          <span>/</span>
          <Link href={ROUTES.project(projectId)} className="hover:text-foreground transition-colors">
            Project
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Tests</span>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => api.post(`/projects/${projectId}/runs`).then(() => refetch())}
          >
            ▶ Run all
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={tests.length === 0}>
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button asChild size="sm">
            <Link href={ROUTES.projectTestNew(projectId)}>+ New test</Link>
          </Button>
        </div>
      </header>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground text-sm mb-4">No tests yet</p>
            <Button asChild size="sm">
              <Link href={ROUTES.projectTestNew(projectId)}>Create test</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Drag to reorder · {tests.length} test{tests.length !== 1 ? 's' : ''}
            </p>
            {tests.map((test) => {
              const status = lastRunStatus(test)
              return (
                <div
                  key={test.id}
                  draggable
                  onDragStart={() => handleDragStart(test.id)}
                  onDragOver={(e) => handleDragOver(e, test.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 bg-card rounded-xl border px-4 py-4
                              cursor-grab active:cursor-grabbing transition-all ${
                    dragging === test.id
                      ? 'opacity-50 border-ring'
                      : 'border-border hover:border-ring hover:shadow-sm'
                  }`}
                >
                  <span className="text-muted-foreground select-none text-lg">⠿</span>
                  <StatusDot status={status} />
                  <Link href={ROUTES.test(test.id)} className="flex-1 min-w-0">
                    <p className="font-medium text-card-foreground truncate">{test.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {test._count?.steps ?? 0} steps
                      {test.prerequisites.length > 0 && (
                        <span className="ml-2">
                          · needs: {test.prerequisites.map((p) => p.name).join(', ')}
                        </span>
                      )}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {test.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {!test.enabled && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        disabled
                      </Badge>
                    )}
                    {confirmDeleteId === test.id ? (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.preventDefault()}
                        onDragStart={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs text-destructive font-medium">Delete?</span>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={deleting}
                          onClick={(e) => { e.preventDefault(); handleDelete(test.id) }}
                        >
                          {deleting ? '…' : 'Yes'}
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={(e) => { e.preventDefault(); setConfirmDeleteId(null) }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.preventDefault(); setConfirmDeleteId(test.id) }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function StatusDot({ status }: { status?: RunStatus }) {
  const colors: Record<RunStatus, string> = {
    PASSED: 'bg-green-500',
    FAILED: 'bg-red-500',
    RUNNING: 'bg-blue-500 animate-pulse',
    QUEUED: 'bg-yellow-400',
    CANCELLED: 'bg-muted',
  }
  return (
    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
      status ? colors[status] : 'bg-muted'
    }`} />
  )
}
