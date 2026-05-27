'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TestRun, RunStatus } from '@/lib/types'
import { Badge } from '@iris/ui/components/badge'
import { Skeleton } from '@iris/ui/components/skeleton'

interface Props {
  testId: string
  selectedRunId?: string | null
  onSelectRun?: (id: string | null) => void
}

export function RunHistory({ testId, selectedRunId, onSelectRun }: Props) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['runs', testId],
    queryFn: () => api.get<TestRun[]>(`/tests/${testId}/runs`),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No runs yet
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const selected = selectedRunId === run.id
        return (
          <div
            key={run.id}
            onClick={() => onSelectRun?.(selected ? null : run.id)}
            className={`flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
              selected ? 'bg-primary/5 border-primary/40' : 'bg-card border-border hover:border-ring'
            }`}
          >
            <StatusBadge status={run.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground">
                {run.passedSteps}/{run.totalSteps} steps passed
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(run.createdAt).toLocaleString()}
              </p>
            </div>
            {run.errorMessage && (
              <p className="text-xs text-destructive truncate max-w-xs">{run.errorMessage}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }: { status: RunStatus }) {
  const variants: Record<RunStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    PASSED: 'default',
    FAILED: 'destructive',
    RUNNING: 'secondary',
    QUEUED: 'outline',
    CANCELLED: 'outline',
  }
  return <Badge variant={variants[status]}>{status}</Badge>
}
