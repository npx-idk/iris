'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence, type Variants, type Transition } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Folder01Icon, FolderOpenIcon, GridIcon, Add01Icon,
  Delete02Icon, FolderTransferIcon, Cancel01Icon, ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { api } from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { Test, Folder, RunStatus } from '@/lib/types'
import { Label } from '@iris/ui/components/label'
import { Textarea } from '@iris/ui/components/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@iris/ui/components/animate-ui/components/radix/dialog'
import { Button } from '@iris/ui/components/button'
import { Badge } from '@iris/ui/components/badge'
import { Skeleton } from '@iris/ui/components/skeleton'
import { Separator } from '@iris/ui/components/separator'
import { Input } from '@iris/ui/components/input'
import { SidebarTrigger } from '@iris/ui/components/sidebar'
import { Checkbox } from '@iris/ui/components/animate-ui/components/radix/checkbox'
import { SlidingNumber } from '@iris/ui/components/animate-ui/primitives/texts/sliding-number'
import { GenerateTestsSheet } from '@/components/tests/GenerateTestsSheet'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuItem,
} from '@iris/ui/components/animate-ui/components/radix/dropdown-menu'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FolderNode extends Folder {
  children: FolderNode[]
}

function buildTree(folders: Folder[], parentId: string | null = null): FolderNode[] {
  return folders
    .filter(f => f.parentId === parentId)
    .map(f => ({ ...f, children: buildTree(folders, f.id) }))
}

// Flatten tree to a labeled list for dropdowns, with indentation info
function flattenTree(nodes: FolderNode[], depth = 0): { folder: Folder; depth: number }[] {
  return nodes.flatMap(n => [{ folder: n, depth }, ...flattenTree(n.children, depth + 1)])
}

// Collect IDs of a node and all its descendants
function getDescendantIds(node: FolderNode): Set<string> {
  const ids = new Set<string>([node.id])
  for (const child of node.children) getDescendantIds(child).forEach(id => ids.add(id))
  return ids
}

function findNode(nodes: FolderNode[], id: string): FolderNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

// ── Motion config (management-bar pattern) ────────────────────────────────────

const EXPAND_CONFIG = {
  initial: 'rest', whileHover: 'hover', whileTap: 'tap',
  variants: {
    rest: { maxWidth: '40px' },
    hover: { maxWidth: '160px', transition: { type: 'spring', stiffness: 200, damping: 35, delay: 0.1 } },
    tap: { scale: 0.95 },
  },
  transition: { type: 'spring', stiffness: 250, damping: 25 },
} as const

const LABEL_VARIANTS: Variants = {
  rest: { opacity: 0, x: 6 },
  hover: { opacity: 1, x: 0, visibility: 'visible' },
  tap: { opacity: 1, x: 0, visibility: 'visible' },
}
const LABEL_TRANSITION: Transition = { type: 'spring', stiffness: 200, damping: 25 }

// ── BulkBar ───────────────────────────────────────────────────────────────────

function BulkBar({ count, folders, onMove, onDelete, onClear, deleting, moving }: {
  count: number; folders: Folder[]
  onMove: (folderId: string | null) => void; onDelete: () => void
  onClear: () => void; deleting: boolean; moving: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border border-border bg-background p-2 shadow-xl"
    >
      <div className="flex items-center gap-1.5 px-2 min-w-0">
        <SlidingNumber number={count} className="text-sm font-semibold text-foreground" />
        <span className="text-sm text-muted-foreground">selected</span>
      </div>
      <div className="h-6 w-px bg-border rounded-full" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <motion.button {...EXPAND_CONFIG} disabled={moving}
            className="flex h-10 items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-muted px-2.5 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer"
            aria-label="Move to folder">
            <HugeiconsIcon icon={FolderTransferIcon} className="size-5 shrink-0" />
            <motion.span variants={LABEL_VARIANTS} transition={LABEL_TRANSITION} className="invisible text-sm pr-1">
              {moving ? 'Moving…' : 'Move to'}
            </motion.span>
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="mb-2 w-48">
          <DropdownMenuItem onSelect={() => onMove(null)}>Unfiled</DropdownMenuItem>
          {folders.map((f) => (
            <DropdownMenuItem key={f.id} onSelect={() => onMove(f.id)}>{f.name}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AnimatePresence mode="wait">
        {confirmDelete ? (
          <motion.div key="confirm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-1.5 px-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Delete {count}?</span>
            <Button size="sm" variant="destructive" disabled={deleting} onClick={onDelete} className="h-8">
              {deleting ? 'Deleting…' : 'Confirm'}
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </motion.div>
        ) : (
          <motion.button key="delete" {...EXPAND_CONFIG} onClick={() => setConfirmDelete(true)}
            className="flex h-10 items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-destructive/10 px-2.5 py-2 text-destructive cursor-pointer"
            aria-label="Delete selected">
            <HugeiconsIcon icon={Delete02Icon} className="size-5 shrink-0" />
            <motion.span variants={LABEL_VARIANTS} transition={LABEL_TRANSITION} className="invisible text-sm pr-1">Delete</motion.span>
          </motion.button>
        )}
      </AnimatePresence>
      <div className="h-6 w-px bg-border rounded-full" />
      <button onClick={onClear}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Clear selection">
        <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
      </button>
    </motion.div>
  )
}

// ── StatusDot ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status?: RunStatus }) {
  const colors: Record<RunStatus, string> = {
    PASSED: 'bg-green-500', FAILED: 'bg-red-500',
    RUNNING: 'bg-blue-500 animate-pulse', QUEUED: 'bg-yellow-400', CANCELLED: 'bg-muted',
  }
  return <div className={`size-2 rounded-full shrink-0 ${status ? colors[status] : 'bg-muted/60'}`} />
}

// ── TestRow ───────────────────────────────────────────────────────────────────

function TestRow({ test, flatFolders, selected, selecting, onToggleSelect,
  confirmDeleteId, deleting, onSetConfirmDelete, onDelete, onMove }: {
  test: Test; flatFolders: { folder: Folder; depth: number }[]
  selected: boolean; selecting: boolean
  onToggleSelect: (id: string) => void; confirmDeleteId: string | null
  deleting: boolean; onSetConfirmDelete: (id: string | null) => void
  onDelete: (id: string) => void; onMove: (testId: string, folderId: string | null) => void
}) {
  const lastRun = test.runs?.[0]
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 group border-b border-border last:border-0 transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-muted/30'} ${selecting ? 'cursor-pointer' : ''}`}
      onClick={() => selecting && onToggleSelect(test.id)}
    >
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Checkbox checked={selected} size="sm" onCheckedChange={() => onToggleSelect(test.id)} />
      </div>
      <StatusDot status={lastRun?.status as RunStatus | undefined} />
      <Link href={ROUTES.test(test.id)}
        className="flex-1 min-w-0 text-sm text-foreground truncate hover:underline"
        onClick={(e) => selecting && e.preventDefault()}>
        {test.name}
      </Link>
      {!selecting && (
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">{test._count?.steps ?? 0} steps</span>
          {!test.enabled && <Badge variant="secondary" className="text-xs">off</Badge>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="h-6 px-2 text-xs text-muted-foreground">Move</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuRadioGroup value={test.folderId ?? ''} onValueChange={(v) => onMove(test.id, v || null)}>
                <DropdownMenuRadioItem value="">Unfiled</DropdownMenuRadioItem>
                {flatFolders.map(({ folder, depth }) => (
                  <DropdownMenuRadioItem key={folder.id} value={folder.id}>
                    {depth > 0 && <span className="text-muted-foreground/50">{'  '.repeat(depth)}</span>}
                    {folder.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {confirmDeleteId === test.id ? (
            <div className="flex items-center gap-1">
              <Button size="xs" variant="destructive" className="h-6 px-2 text-xs"
                disabled={deleting} onClick={() => onDelete(test.id)}>{deleting ? '…' : 'Yes'}</Button>
              <Button size="xs" variant="ghost" className="h-6 px-2 text-xs"
                onClick={() => onSetConfirmDelete(null)}>No</Button>
            </div>
          ) : (
            <Button size="xs" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => onSetConfirmDelete(test.id)}>Delete</Button>
          )}
        </div>
      )}
      {selecting && <span className="text-xs text-muted-foreground tabular-nums shrink-0">{test._count?.steps ?? 0} steps</span>}
    </div>
  )
}

// ── SidebarFolder (recursive) ─────────────────────────────────────────────────

function SidebarFolder({ node, depth = 0, selectedFolderId, expandedIds, renamingFolder,
  onSelect, onToggleExpand, onStartRename, onRenameSubmit, onRenameChange, onDelete, onStartSubfolder,
  onMoveFolder, flatFolders,
  creatingParentId, creatingName, onCreatingNameChange, onCreateSubmit, savingFolder,
}: {
  node: FolderNode; depth?: number
  selectedFolderId: string | null | 'all'; expandedIds: Set<string>
  renamingFolder: { id: string; name: string } | null
  onSelect: (id: string) => void; onToggleExpand: (id: string) => void
  onStartRename: (folder: Folder) => void; onRenameSubmit: (e: React.FormEvent) => void
  onRenameChange: (name: string) => void; onDelete: (id: string) => void
  onStartSubfolder: (parentId: string) => void
  onMoveFolder: (folderId: string, parentId: string | null) => void
  flatFolders: { folder: Folder; depth: number }[]
  creatingParentId: string | null | undefined; creatingName: string
  onCreatingNameChange: (v: string) => void; onCreateSubmit: (e: React.FormEvent) => void
  savingFolder: boolean
}) {
  const isSelected = selectedFolderId === node.id
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const isRenaming = renamingFolder?.id === node.id
  const pl = depth * 12
  const excludeIds = getDescendantIds(node) // can't move into self or descendants
  const moveTargets = flatFolders.filter(({ folder }) => !excludeIds.has(folder.id))

  return (
    <>
      <div
        className={`group/folder flex items-center rounded-md transition-colors ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'}`}
        style={{ paddingLeft: pl }}
      >
        {/* Expand/collapse chevron */}
        <button
          className={`flex items-center justify-center size-5 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''} ${!hasChildren ? 'invisible' : ''}`}
          onClick={() => onToggleExpand(node.id)}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
        </button>

        {isRenaming ? (
          <form onSubmit={onRenameSubmit} className="flex items-center gap-1 py-1 flex-1 min-w-0 pr-1"
            onClick={e => e.stopPropagation()}>
            <Input autoFocus value={renamingFolder!.name} onChange={(e) => onRenameChange(e.target.value)}
              className="h-6 text-xs flex-1" onKeyDown={(e) => e.key === 'Escape' && onStartRename({ ...node, name: '' } as any)} />
            <Button type="submit" size="xs" className="h-5 px-1.5 text-xs shrink-0">✓</Button>
          </form>
        ) : (
          <>
            <button className="flex items-center gap-1.5 py-1.5 pr-1 flex-1 min-w-0 text-left"
              onClick={() => onSelect(node.id)}>
              <HugeiconsIcon
                icon={isSelected || isExpanded ? FolderOpenIcon : Folder01Icon}
                className={`size-4 shrink-0 ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
              />
              <span className={`text-sm flex-1 truncate ${isSelected ? 'text-accent-foreground font-medium' : 'text-muted-foreground'}`}>
                {node.name}
              </span>
            </button>
            <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover/folder:opacity-100 transition-opacity shrink-0"
              onClick={e => e.stopPropagation()}>
              <Button size="xs" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground"
                title="Add subfolder" onClick={() => { onToggleExpand(node.id); onStartSubfolder(node.id) }}>+</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="xs" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground" title="Move to folder">
                    <HugeiconsIcon icon={FolderTransferIcon} className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-44">
                  <DropdownMenuItem onSelect={() => onMoveFolder(node.id, null)}
                    className={node.parentId === null ? 'font-medium' : ''}>
                    Root level
                  </DropdownMenuItem>
                  {moveTargets.map(({ folder, depth: d }) => (
                    <DropdownMenuItem key={folder.id} onSelect={() => onMoveFolder(node.id, folder.id)}
                      className={node.parentId === folder.id ? 'font-medium' : ''}>
                      {d > 0 && <span className="text-muted-foreground/50 mr-0.5">{'  '.repeat(d)}</span>}
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="xs" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground"
                onClick={() => onStartRename(node)}>✎</Button>
              <Button size="xs" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(node.id)}>✕</Button>
            </div>
          </>
        )}
      </div>

      {/* Subfolder creation inline form */}
      {creatingParentId === node.id && (
        <form onSubmit={onCreateSubmit} className="flex items-center gap-1 py-1 pr-1"
          style={{ paddingLeft: pl + 20 }}>
          <Input autoFocus value={creatingName} onChange={(e) => onCreatingNameChange(e.target.value)}
            placeholder="Subfolder name" className="h-6 text-xs flex-1"
            onKeyDown={(e) => e.key === 'Escape' && onStartSubfolder('__cancel__')} />
          <Button type="submit" size="xs" className="h-5 px-1.5 text-xs shrink-0"
            disabled={savingFolder || !creatingName.trim()}>{savingFolder ? '…' : '✓'}</Button>
        </form>
      )}

      {/* Recursive children */}
      {isExpanded && node.children.map(child => (
        <SidebarFolder key={child.id} node={child} depth={depth + 1}
          selectedFolderId={selectedFolderId} expandedIds={expandedIds}
          renamingFolder={renamingFolder} onSelect={onSelect} onToggleExpand={onToggleExpand}
          onStartRename={onStartRename} onRenameSubmit={onRenameSubmit} onRenameChange={onRenameChange}
          onDelete={onDelete} onStartSubfolder={onStartSubfolder}
          onMoveFolder={onMoveFolder} flatFolders={flatFolders}
          creatingParentId={creatingParentId} creatingName={creatingName}
          onCreatingNameChange={onCreatingNameChange} onCreateSubmit={onCreateSubmit}
          savingFolder={savingFolder} />
      ))}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TestsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()

  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'all'>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [generateOpen, setGenerateOpen] = useState(false)
  const [newTestOpen, setNewTestOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Folder editing
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null)
  // creatingParentId: undefined=closed, null=root, string=subfolder under that id
  const [creatingParentId, setCreatingParentId] = useState<string | null | undefined>(undefined)
  const [creatingName, setCreatingName] = useState('')
  const [savingFolder, setSavingFolder] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkMoving, setBulkMoving] = useState(false)

  const [operationError, setOperationError] = useState<string | null>(null)

  const { data: tests = [], isLoading, refetch } = useQuery({
    queryKey: ['tests', projectId],
    queryFn: () => api.get<Test[]>(`/projects/${projectId}/tests`),
  })
  const { data: folders = [], refetch: refetchFolders } = useQuery({
    queryKey: ['folders', projectId],
    queryFn: () => api.get<Folder[]>(`/projects/${projectId}/folders`),
  })
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<{ baseUrl: string }>(`/projects/${projectId}`),
  })

  const folderTree = buildTree(folders)
  const flatFolders = flattenTree(folderTree)

  const selectedNode = typeof selectedFolderId === 'string' && selectedFolderId !== 'all'
    ? findNode(folderTree, selectedFolderId)
    : null

  // Direct child folders of the selected folder (shown as cards in main area)
  const childFolders: FolderNode[] = selectedNode?.children ?? []

  const visibleTests =
    selectedFolderId === 'all' ? tests
    : selectedFolderId === null ? tests.filter(t => !t.folderId)
    : tests.filter(t => t.folderId === selectedFolderId)

  const selectedFolder = folders.find(f => f.id === selectedFolderId)
  const sectionTitle =
    selectedFolderId === 'all' ? 'All tests'
    : selectedFolderId === null ? 'Unfiled'
    : selectedFolder?.name ?? 'Tests'

  const selecting = selectedIds.size > 0
  const selectedVisibleCount = visibleTests.filter(t => selectedIds.has(t.id)).length
  const allVisibleSelected = visibleTests.length > 0 && selectedVisibleCount === visibleTests.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(prev => { const next = new Set(prev); visibleTests.forEach(t => next.delete(t.id)); return next })
    } else {
      setSelectedIds(prev => new Set([...prev, ...visibleTests.map(t => t.id)]))
    }
  }

  function clearSelection() { setSelectedIds(new Set()) }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await Promise.all([...selectedIds].map(id => api.delete(`/tests/${id}`)))
      clearSelection(); refetch()
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to delete tests')
    } finally { setBulkDeleting(false) }
  }

  async function handleBulkMove(folderId: string | null) {
    setBulkMoving(true)
    try {
      await Promise.all([...selectedIds].map(id => api.patch(`/tests/${id}`, { folderId })))
      clearSelection(); refetch()
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to move tests')
    } finally { setBulkMoving(false) }
  }

  const testRowProps = {
    flatFolders, confirmDeleteId, deleting,
    onSetConfirmDelete: setConfirmDeleteId,
    onDelete: async (testId: string) => {
      setDeleting(true)
      try { await api.delete(`/tests/${testId}`); setConfirmDeleteId(null); refetch() }
      finally { setDeleting(false) }
    },
    onMove: async (testId: string, folderId: string | null) => {
      await api.patch(`/tests/${testId}`, { folderId }); refetch()
    },
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!creatingName.trim()) return
    setSavingFolder(true)
    try {
      const created = await api.post<{ id: string }>(`/projects/${projectId}/folders`, {
        name: creatingName.trim(),
        parentId: creatingParentId ?? null,
      })
      setCreatingName(''); setCreatingParentId(undefined)
      refetchFolders()
      setSelectedFolderId(created.id)
      if (creatingParentId) {
        setExpandedIds(prev => new Set([...prev, creatingParentId as string]))
      }
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally { setSavingFolder(false) }
  }

  async function handleRenameFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!renamingFolder?.name.trim()) return
    try {
      await api.patch(`/folders/${renamingFolder.id}`, { name: renamingFolder.name })
      setRenamingFolder(null); refetchFolders()
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to rename folder')
    }
  }

  async function handleDeleteFolder(folderId: string) {
    try {
      await api.delete(`/folders/${folderId}`)
      if (selectedFolderId === folderId) setSelectedFolderId('all')
      refetchFolders(); refetch()
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to delete folder')
    }
  }

  async function handleMoveFolder(folderId: string, parentId: string | null) {
    try {
      await api.patch(`/folders/${folderId}`, { parentId })
      refetchFolders()
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to move folder')
    }
  }

  function handleStartSubfolder(parentId: string) {
    if (parentId === '__cancel__') { setCreatingParentId(undefined); setCreatingName(''); return }
    setCreatingParentId(parentId); setCreatingName('')
  }

  const newTestSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    startUrl: z.string()
      .refine((v) => !v || /^https?:\/\/.+/.test(v), 'Enter a valid URL')
      .optional(),
    tags: z.string().optional(),
  })
  type NewTestValues = z.infer<typeof newTestSchema>

  const newTestForm = useForm<NewTestValues>({
    resolver: zodResolver(newTestSchema as any),
    mode: 'onBlur',
  })

  async function handleCreateTest(values: NewTestValues) {
    const tags = values.tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? []
    const test = await api.post<{ id: string }>(`/projects/${projectId}/tests`, {
      name: values.name,
      description: values.description || undefined,
      startUrl: values.startUrl || undefined,
      folderId: typeof selectedFolderId === 'string' && selectedFolderId !== 'all' ? selectedFolderId : undefined,
      tags,
    })
    newTestForm.reset()
    setNewTestOpen(false)
    refetch()
    router.push(ROUTES.test(test.id))
  }

  async function handleExport() {
    const data = await api.get(`/projects/${projectId}/export`)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `iris-suite-${projectId}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; setImporting(true)
    try {
      const json = JSON.parse(await file.text())
      await api.post(`/projects/${projectId}/import`, json.tests ? { tests: json.tests } : json)
      refetch()
    } finally { setImporting(false) }
  }

  const sidebarFolderProps = {
    selectedFolderId, expandedIds, renamingFolder,
    onSelect: setSelectedFolderId,
    onToggleExpand: toggleExpand,
    onStartRename: (folder: Folder) => setRenamingFolder({ id: folder.id, name: folder.name }),
    onRenameSubmit: handleRenameFolder,
    onRenameChange: (name: string) => setRenamingFolder(prev => prev ? { ...prev, name } : null),
    onDelete: handleDeleteFolder,
    onStartSubfolder: handleStartSubfolder,
    onMoveFolder: handleMoveFolder,
    flatFolders,
    creatingParentId, creatingName,
    onCreatingNameChange: setCreatingName,
    onCreateSubmit: handleCreateFolder,
    savingFolder,
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href={ROUTES.dashboard} className="hover:text-foreground transition-colors">Projects</Link>
          <span>/</span>
          <Link href={ROUTES.project(projectId)} className="hover:text-foreground transition-colors">Project</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Tests</span>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm"
            onClick={() => api.post(`/projects/${projectId}/runs`).then(() => refetch())}>▶ Run all</Button>
          <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>✨ Generate</Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={tests.length === 0}>Export</Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <Button size="sm" onClick={() => setNewTestOpen(true)}>+ New test</Button>
        </div>
      </header>

      {operationError && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-sm text-destructive">
          <span>{operationError}</span>
          <button onClick={() => setOperationError(null)} className="shrink-0 text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Folder sidebar */}
        <aside className="w-56 shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {isLoading ? (
              <div className="space-y-1 p-1">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
              </div>
            ) : (
              <>
                {/* All tests */}
                <button onClick={() => setSelectedFolderId('all')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                    selectedFolderId === 'all'
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}>
                  <HugeiconsIcon icon={GridIcon} className="size-4 shrink-0" />
                  <span className="flex-1 text-left truncate">All tests</span>
                  <span className="text-xs tabular-nums">{tests.length}</span>
                </button>

                {/* Folder tree */}
                {folderTree.map(node => (
                  <SidebarFolder key={node.id} node={node} {...sidebarFolderProps} />
                ))}

                {/* Root-level new folder inline form */}
                {creatingParentId === null && (
                  <form onSubmit={handleCreateFolder} className="flex items-center gap-1 px-2 py-1">
                    <Input autoFocus value={creatingName} onChange={(e) => setCreatingName(e.target.value)}
                      placeholder="Folder name" className="h-6 text-xs flex-1"
                      onKeyDown={(e) => e.key === 'Escape' && setCreatingParentId(undefined)} />
                    <Button type="submit" size="xs" className="h-5 px-1.5 text-xs shrink-0"
                      disabled={savingFolder || !creatingName.trim()}>{savingFolder ? '…' : '✓'}</Button>
                  </form>
                )}

                {/* Unfiled */}
                {tests.some(t => !t.folderId) && (
                  <button onClick={() => setSelectedFolderId(null)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      selectedFolderId === null
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}>
                    <HugeiconsIcon icon={Folder01Icon} className="size-4 shrink-0 opacity-40" />
                    <span className="flex-1 text-left truncate">Unfiled</span>
                    <span className="text-xs tabular-nums">{tests.filter(t => !t.folderId).length}</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="p-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground gap-2"
              onClick={() => { setCreatingParentId(null); setCreatingName('') }}>
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
              New folder
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <Checkbox
              checked={someVisibleSelected ? 'indeterminate' : allVisibleSelected}
              size="sm" onCheckedChange={toggleSelectAll} disabled={visibleTests.length === 0}
            />
            <h2 className="text-sm font-semibold text-foreground">{sectionTitle}</h2>
            <Badge variant="secondary" className="text-xs tabular-nums">{visibleTests.length}</Badge>
          </div>

          {childFolders.length === 0 && visibleTests.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                {selectedFolderId === 'all' ? 'No tests yet' : 'No tests in this folder'}
              </p>
              <Button size="sm" onClick={() => setNewTestOpen(true)}>+ New test</Button>
            </div>
          ) : (
            <div>
              {childFolders.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-4 border-b border-border">
                  {childFolders.map(folder => {
                    const subtreeIds = getDescendantIds(folder)
                    const count = tests.filter(t => t.folderId && subtreeIds.has(t.folderId)).length
                    return (
                      <button key={folder.id} onClick={() => setSelectedFolderId(folder.id)}
                        className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 text-left hover:bg-accent/50 transition-colors">
                        <HugeiconsIcon icon={Folder01Icon} className="size-6 text-muted-foreground" />
                        <div className="w-full">
                          <p className="text-sm font-medium text-foreground truncate">{folder.name}</p>
                          <p className="text-xs text-muted-foreground">{count} {count === 1 ? 'test' : 'tests'}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {visibleTests.length > 0 && (
                <div>
                  {visibleTests.map(test => (
                    <TestRow key={test.id} test={test} selected={selectedIds.has(test.id)}
                      selecting={selecting} onToggleSelect={toggleSelect} {...testRowProps} />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {selecting && (
          <BulkBar count={selectedIds.size} folders={folders}
            onMove={handleBulkMove} onDelete={handleBulkDelete}
            onClear={clearSelection} deleting={bulkDeleting} moving={bulkMoving} />
        )}
      </AnimatePresence>

      <GenerateTestsSheet open={generateOpen} onOpenChange={setGenerateOpen}
        projectId={projectId} defaultUrl={project?.baseUrl ?? ''} onSaved={refetch} />

      <Dialog open={newTestOpen} onOpenChange={(o) => { if (!o) newTestForm.reset(); setNewTestOpen(o) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New test</DialogTitle>
          </DialogHeader>
          <form onSubmit={newTestForm.handleSubmit(handleCreateTest)} className="flex flex-col gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nt-name">Name <span className="text-destructive">*</span></Label>
              <Input id="nt-name" placeholder="Login flow" {...newTestForm.register('name')} />
              {newTestForm.formState.errors.name && (
                <p className="text-xs text-destructive">{newTestForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nt-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="nt-desc" placeholder="What does this test verify?" {...newTestForm.register('description')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nt-url">Start URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="nt-url" placeholder="https://example.com/login" {...newTestForm.register('startUrl')} />
              {newTestForm.formState.errors.startUrl && (
                <p className="text-xs text-destructive">{newTestForm.formState.errors.startUrl.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Overrides the project base URL</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nt-tags">Tags <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="nt-tags" placeholder="smoke, auth, critical" {...newTestForm.register('tags')} />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNewTestOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={newTestForm.formState.isSubmitting}>
                {newTestForm.formState.isSubmitting ? 'Creating…' : 'Create test'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
