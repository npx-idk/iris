'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { FlowSquareIcon, Add01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { api } from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { FlowSummary } from '@/lib/types'
import { Button } from '@iris/ui/components/button'
import { Input } from '@iris/ui/components/input'
import { Skeleton } from '@iris/ui/components/skeleton'
import { Separator } from '@iris/ui/components/separator'
import { SidebarTrigger } from '@iris/ui/components/sidebar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@iris/ui/components/animate-ui/components/radix/dialog'

export default function FlowsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: flows = [], isLoading, refetch } = useQuery({
    queryKey: ['flows', projectId],
    queryFn: () => api.get<FlowSummary[]>(`/projects/${projectId}/flows`),
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const flow = await api.post<{ id: string }>(`/projects/${projectId}/flows`, { name: newName.trim() })
      setCreateOpen(false)
      setNewName('')
      router.push(ROUTES.projectFlow(projectId, flow.id))
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(flowId: string) {
    setDeletingId(flowId)
    try {
      await api.delete(`/flows/${flowId}`)
      refetch()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href={ROUTES.dashboard} className="hover:text-foreground transition-colors">Projects</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Flows</span>
        </nav>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} size={14} color="currentColor" strokeWidth={1.5} />
            New flow
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
            <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
              <HugeiconsIcon icon={FlowSquareIcon} size={24} color="currentColor" strokeWidth={1.5} className="text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-foreground">No flows yet</h2>
              <p className="text-xs text-muted-foreground mt-1">Build a visual pipeline by chaining test suites together</p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>Create flow</Button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {flows.map(flow => (
              <div key={flow.id} className="group relative rounded-xl border border-border bg-card p-4 hover:bg-accent/30 transition-colors">
                <Link href={ROUTES.projectFlow(projectId, flow.id)} className="flex flex-col gap-3 h-full">
                  <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <HugeiconsIcon icon={FlowSquareIcon} size={18} color="currentColor" strokeWidth={1.5} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{flow.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(flow.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(flow.id)}
                  disabled={deletingId === flow.id}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label="Delete flow"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={14} color="currentColor" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setNewName(''); setCreateOpen(o) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New flow</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 py-2">
            <Input
              autoFocus
              placeholder="e.g. Onboarding flow"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !newName.trim()}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
