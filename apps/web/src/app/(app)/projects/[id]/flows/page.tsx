"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  FlowSquareIcon,
  Add01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { FlowSummary } from "@/lib/types"
import { Button } from "@iris/ui/components/button"
import { Input } from "@iris/ui/components/input"
import { ListSkeleton } from "@/components/shared/ListSkeleton"
import { Separator } from "@iris/ui/components/separator"
import { SidebarTrigger } from "@iris/ui/components/sidebar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@iris/ui/components/animate-ui/components/radix/dialog"

export default function FlowsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const {
    data: flows = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["flows", projectId],
    queryFn: () => api.get<FlowSummary[]>(`/projects/${projectId}/flows`),
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const flow = await api.post<{ id: string }>(
        `/projects/${projectId}/flows`,
        { name: newName.trim() }
      )
      setCreateOpen(false)
      setNewName("")
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
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            href={ROUTES.dashboard}
            className="transition-colors hover:text-foreground"
          >
            Projects
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">Flows</span>
        </nav>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <HugeiconsIcon
              icon={Add01Icon}
              size={14}
              color="currentColor"
              strokeWidth={1.5}
            />
            New flow
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            <ListSkeleton count={4} className="h-28 rounded-xl" />
          </div>
        ) : flows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <HugeiconsIcon
                icon={FlowSquareIcon}
                size={24}
                color="currentColor"
                strokeWidth={1.5}
                className="text-muted-foreground"
              />
            </div>
            <div>
              <h2 className="text-sm font-medium text-foreground">
                No flows yet
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Build a visual pipeline by chaining test suites together
              </p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Create flow
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className="group relative rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/30"
              >
                <Link
                  href={ROUTES.projectFlow(projectId, flow.id)}
                  className="flex h-full flex-col gap-3"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <HugeiconsIcon
                      icon={FlowSquareIcon}
                      size={18}
                      color="currentColor"
                      strokeWidth={1.5}
                      className="text-muted-foreground"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {flow.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(flow.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(flow.id)}
                  disabled={deletingId === flow.id}
                  className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete flow"
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    size={14}
                    color="currentColor"
                    strokeWidth={1.5}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) setNewName("")
          setCreateOpen(o)
        }}
      >
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newName.trim()}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
