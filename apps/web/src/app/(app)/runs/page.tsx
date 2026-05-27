'use client'

import Link from 'next/link'
import { api } from '@/lib/api'
import { useActiveRuns } from '@/hooks/useActiveRuns'
import { ROUTES } from '@/lib/routes'
import type { ActiveRun } from '@/lib/types'
import { Button } from '@iris/ui/components/button'
import { Badge } from '@iris/ui/components/badge'
import { Separator } from '@iris/ui/components/separator'
import { SidebarTrigger } from '@iris/ui/components/sidebar'

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'RUNNING') return 'default'
  if (status === 'QUEUED') return 'secondary'
  return 'outline'
}

function elapsed(createdAt: string) {
  const secs = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function RunRow({ run, onCancel }: { run: ActiveRun; onCancel: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-4 min-w-0">
        <Badge variant={statusVariant(run.status)} className="shrink-0 text-xs">
          {run.status === 'RUNNING' && (
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary-foreground animate-pulse" />
          )}
          {run.status}
        </Badge>
        <div className="min-w-0">
          <Link
            href={ROUTES.test(run.test.id)}
            className="text-sm font-medium text-foreground hover:underline truncate block"
          >
            {run.test.name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{run.test.project.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-xs text-muted-foreground tabular-nums">{elapsed(run.createdAt)}</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive text-xs"
          onClick={() => onCancel(run.id)}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

export default function RunsPage() {
  const runs = useActiveRuns()

  async function handleCancel(runId: string) {
    await api.post(`/runs/${runId}/cancel`)
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-medium text-foreground">Active runs</span>
        <Badge variant="secondary" className="ml-2 text-xs tabular-nums">{runs.length}</Badge>
      </header>

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {runs.length === 0 ? (
            <p className="px-5 py-12 text-sm text-muted-foreground text-center">
              No tests are currently queued or running
            </p>
          ) : (
            runs.map((run) => (
              <RunRow key={run.id} run={run} onCancel={handleCancel} />
            ))
          )}
        </div>
      </div>
    </>
  )
}
