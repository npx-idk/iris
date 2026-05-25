'use client'

import { useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { Test, TestGroup, RunStatus } from '@/lib/types'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Separator } from '@workspace/ui/components/separator'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'
import { Input } from '@workspace/ui/components/input'
import { GenerateTestsSheet } from '@/components/tests/GenerateTestsSheet'

export default function TestsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState<string | null>(null)
  const [localTests, setLocalTests] = useState<Test[] | null>(null)

  // ── Import / Export ────────────────────────────────────────────────────────
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Multi-select ───────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // ── AI generate ───────────────────────────────────────────────────────────
  const [generateOpen, setGenerateOpen] = useState(false)

  // ── Groups ─────────────────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null)

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: fetchedTests = [], isLoading, refetch } = useQuery({
    queryKey: ['tests', projectId],
    queryFn: () => api.get<Test[]>(`/projects/${projectId}/tests`),
  })

  const { data: groups = [], refetch: refetchGroups } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => api.get<TestGroup[]>(`/projects/${projectId}/groups`),
  })

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<{ baseUrl: string }>(`/projects/${projectId}`),
  })

  const tests = localTests ?? fetchedTests

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
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

  // ── Export / Import ────────────────────────────────────────────────────────
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

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Multi-select ───────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === tests.length ? new Set() : new Set(tests.map((t) => t.id))
    )
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await Promise.allSettled([...selectedIds].map((id) => api.delete(`/tests/${id}`)))
      setSelectedIds(new Set())
      setBulkConfirm(false)
      refetch()
    } finally {
      setBulkDeleting(false)
    }
  }

  // ── Groups ─────────────────────────────────────────────────────────────────
  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setSavingGroup(true)
    try {
      await api.post(`/projects/${projectId}/groups`, { name: newGroupName.trim() })
      setNewGroupName('')
      setCreatingGroup(false)
      refetchGroups()
    } finally {
      setSavingGroup(false)
    }
  }

  async function handleRenameGroup(groupId: string) {
    if (!editGroupName.trim()) return
    await api.patch(`/groups/${groupId}`, { name: editGroupName.trim() })
    setEditingGroupId(null)
    refetchGroups()
  }

  async function handleDeleteGroup(groupId: string) {
    await api.delete(`/groups/${groupId}`)
    setConfirmDeleteGroupId(null)
    refetchGroups()
    refetch()
  }

  async function handleMoveToGroup(testId: string, groupId: string | null) {
    await api.patch(`/tests/${testId}`, { groupId })
    refetch()
  }

  // ── Computed groups layout ─────────────────────────────────────────────────
  const ungrouped = tests.filter((t) => !t.groupId)
  const groupedTests = new Map<string, Test[]>()
  for (const g of groups) groupedTests.set(g.id, [])
  for (const test of tests) {
    if (test.groupId && groupedTests.has(test.groupId)) {
      groupedTests.get(test.groupId)!.push(test)
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
          <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
            ✨ Generate
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={tests.length === 0}>
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={() => { setCreatingGroup(true); setNewGroupName('') }}>
            + Group
          </Button>
          <Button asChild size="sm">
            <Link href={ROUTES.projectTestNew(projectId)}>+ New test</Link>
          </Button>
        </div>
      </header>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : tests.length === 0 && groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground text-sm mb-4">No tests yet</p>
            <Button asChild size="sm">
              <Link href={ROUTES.projectTestNew(projectId)}>Create test</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bulk-select toolbar */}
            {tests.length > 0 && (
              <div className="flex items-center gap-3 px-1">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selectedIds.size === tests.length && tests.length > 0}
                  ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < tests.length }}
                  onChange={toggleSelectAll}
                />
                {selectedIds.size > 0 ? (
                  bulkConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive font-medium">
                        Delete {selectedIds.size} test{selectedIds.size !== 1 ? 's' : ''}?
                      </span>
                      <Button size="xs" variant="destructive" disabled={bulkDeleting} onClick={handleBulkDelete}>
                        {bulkDeleting ? 'Deleting…' : 'Yes, delete'}
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setBulkConfirm(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                      <Button size="xs" variant="destructive" onClick={() => setBulkConfirm(true)}>Delete selected</Button>
                      <Button size="xs" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Drag to reorder · {tests.length} test{tests.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* New group inline form */}
            {creatingGroup && (
              <form onSubmit={handleCreateGroup} className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group name"
                  className="max-w-xs text-sm"
                />
                <Button type="submit" size="sm" disabled={savingGroup || !newGroupName.trim()}>
                  {savingGroup ? 'Creating…' : 'Create'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCreatingGroup(false)}>
                  Cancel
                </Button>
              </form>
            )}

            {/* Named groups */}
            {groups.map((group) => {
              const groupTests = groupedTests.get(group.id) ?? []
              const isCollapsed = collapsedGroups.has(group.id)
              return (
                <div key={group.id} className="space-y-2">
                  {/* Group header */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(group.id)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={`text-muted-foreground transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      {editingGroupId === group.id ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); handleRenameGroup(group.id) }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2"
                        >
                          <Input
                            autoFocus
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            className="h-6 text-xs px-2 w-48"
                          />
                          <Button type="submit" size="xs" disabled={!editGroupName.trim()}>Save</Button>
                          <Button type="button" size="xs" variant="ghost" onClick={() => setEditingGroupId(null)}>Cancel</Button>
                        </form>
                      ) : (
                        <span className="text-sm font-semibold text-foreground">{group.name}</span>
                      )}
                      <Badge variant="secondary" className="text-xs">{groupTests.length}</Badge>
                    </button>

                    {/* Group actions */}
                    {editingGroupId !== group.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        {confirmDeleteGroupId === group.id ? (
                          <>
                            <span className="text-xs text-destructive font-medium">Delete group?</span>
                            <Button size="xs" variant="destructive" onClick={() => handleDeleteGroup(group.id)}>Yes</Button>
                            <Button size="xs" variant="ghost" onClick={() => setConfirmDeleteGroupId(null)}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="xs" variant="ghost"
                              className="text-muted-foreground"
                              onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name) }}
                            >
                              Rename
                            </Button>
                            <Button
                              size="xs" variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setConfirmDeleteGroupId(group.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Group tests */}
                  {!isCollapsed && (
                    <div className="space-y-2 pl-4 border-l border-border ml-1.5">
                      {groupTests.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No tests in this group</p>
                      ) : (
                        groupTests.map((test) => (
                          <TestRow
                            key={test.id}
                            test={test}
                            groups={groups}
                            status={lastRunStatus(test)}
                            isSelected={selectedIds.has(test.id)}
                            isDragging={dragging === test.id}
                            confirmDeleteId={confirmDeleteId}
                            deleting={deleting}
                            onToggleSelect={() => toggleSelect(test.id)}
                            onDragStart={() => handleDragStart(test.id)}
                            onDragOver={(e) => handleDragOver(e, test.id)}
                            onDragEnd={handleDragEnd}
                            onDelete={() => handleDelete(test.id)}
                            onSetConfirmDelete={(id) => setConfirmDeleteId(id)}
                            onMoveToGroup={(gId) => handleMoveToGroup(test.id, gId)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Ungrouped tests */}
            {(ungrouped.length > 0 || groups.length === 0) && (
              <div className="space-y-2">
                {groups.length > 0 && (
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-sm font-semibold text-muted-foreground">Ungrouped</span>
                    <Badge variant="secondary" className="text-xs">{ungrouped.length}</Badge>
                  </div>
                )}
                <div className="space-y-2">
                  {ungrouped.map((test) => (
                    <TestRow
                      key={test.id}
                      test={test}
                      groups={groups}
                      status={lastRunStatus(test)}
                      isSelected={selectedIds.has(test.id)}
                      isDragging={dragging === test.id}
                      confirmDeleteId={confirmDeleteId}
                      deleting={deleting}
                      onToggleSelect={() => toggleSelect(test.id)}
                      onDragStart={() => handleDragStart(test.id)}
                      onDragOver={(e) => handleDragOver(e, test.id)}
                      onDragEnd={handleDragEnd}
                      onDelete={() => handleDelete(test.id)}
                      onSetConfirmDelete={(id) => setConfirmDeleteId(id)}
                      onMoveToGroup={(gId) => handleMoveToGroup(test.id, gId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <GenerateTestsSheet
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        projectId={projectId}
        defaultUrl={project?.baseUrl ?? ''}
        onSaved={refetch}
      />
    </>
  )
}

// ─── TestRow ──────────────────────────────────────────────────────────────────

interface TestRowProps {
  test: Test
  groups: TestGroup[]
  status?: RunStatus
  isSelected: boolean
  isDragging: boolean
  confirmDeleteId: string | null
  deleting: boolean
  onToggleSelect: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDelete: () => void
  onSetConfirmDelete: (id: string | null) => void
  onMoveToGroup: (groupId: string | null) => void
}

function TestRow({
  test, groups, status, isSelected, isDragging,
  confirmDeleteId, deleting,
  onToggleSelect, onDragStart, onDragOver, onDragEnd,
  onDelete, onSetConfirmDelete, onMoveToGroup,
}: TestRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 bg-card rounded-xl border px-4 py-4
                  cursor-grab active:cursor-grabbing transition-all ${
        isDragging
          ? 'opacity-50 border-ring'
          : isSelected
          ? 'border-ring'
          : 'border-border hover:border-ring hover:shadow-sm'
      }`}
    >
      <input
        type="checkbox"
        className="accent-primary shrink-0"
        checked={isSelected}
        onChange={onToggleSelect}
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
      />
      <span className="text-muted-foreground select-none text-lg">⠿</span>
      <StatusDot status={status} />
      <Link href={ROUTES.test(test.id)} className="flex-1 min-w-0">
        <p className="font-medium text-card-foreground truncate">{test.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {test._count?.steps ?? 0} steps
          {test.prerequisites.length > 0 && (
            <span className="ml-2">· needs: {test.prerequisites.map((p) => p.name).join(', ')}</span>
          )}
        </p>
      </Link>
      <div className="flex items-center gap-2 shrink-0">
        {test.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
        ))}
        {!test.enabled && (
          <Badge variant="outline" className="text-xs text-muted-foreground">disabled</Badge>
        )}

        {/* Group selector */}
        {groups.length > 0 && (
          <select
            value={test.groupId ?? ''}
            onChange={(e) => onMoveToGroup(e.target.value || null)}
            onClick={(e) => e.preventDefault()}
            onDragStart={(e) => e.stopPropagation()}
            className="h-6 rounded-md border border-input bg-card px-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}

        {confirmDeleteId === test.id ? (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.preventDefault()}
            onDragStart={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-destructive font-medium">Delete?</span>
            <Button size="xs" variant="destructive" disabled={deleting}
              onClick={(e) => { e.preventDefault(); onDelete() }}>
              {deleting ? '…' : 'Yes'}
            </Button>
            <Button size="xs" variant="ghost"
              onClick={(e) => { e.preventDefault(); onSetConfirmDelete(null) }}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="xs" variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.preventDefault(); onSetConfirmDelete(test.id) }}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── StatusDot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status?: RunStatus }) {
  const colors: Record<RunStatus, string> = {
    PASSED: 'bg-green-500',
    FAILED: 'bg-red-500',
    RUNNING: 'bg-blue-500 animate-pulse',
    QUEUED: 'bg-yellow-400',
    CANCELLED: 'bg-muted',
  }
  return (
    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${status ? colors[status] : 'bg-muted'}`} />
  )
}
