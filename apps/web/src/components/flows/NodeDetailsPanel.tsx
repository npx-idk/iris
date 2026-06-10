"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  TestTube01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { useRun } from "@/hooks/queries"
import { TestRunStep } from "@/lib/types"
import { Button } from "@iris/ui/components/button"
import { Badge } from "@iris/ui/components/badge"
import { ListSkeleton } from "@/components/shared/ListSkeleton"
import type { TestNodeData } from "./TestSuiteNode"

function StepRow({ step }: { step: TestRunStep }) {
  const isPassed = step.result === "PASSED"
  const isFailed = step.result === "FAILED"
  return (
    <div
      className={`flex gap-2.5 border-b border-border px-3 py-2.5 last:border-0 ${isFailed ? "bg-destructive/5" : ""}`}
    >
      <div className="mt-0.5 shrink-0">
        {isPassed && (
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
            className="text-primary"
          />
        )}
        {isFailed && (
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
            className="text-destructive"
          />
        )}
        {!isPassed && !isFailed && (
          <div className="mt-0.5 size-3.5 rounded-full bg-muted-foreground/30" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-foreground">
          {step.instruction}
        </p>
        {step.errorMessage && (
          <p className="mt-1 text-xs leading-relaxed text-destructive">
            {step.errorMessage}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <HugeiconsIcon
            icon={Clock01Icon}
            size={11}
            color="currentColor"
            strokeWidth={1.5}
            className="text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">
            {(step.durationMs / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  )
}

/** Right-hand sidebar showing run progress and step results for the selected flow node. */
export function NodeDetailsPanel({
  nodeData,
  onClose,
}: {
  nodeData: TestNodeData
  onClose: () => void
}) {
  const runStatus = nodeData.runStatus ?? "idle"
  const { data: run, isLoading } = useRun(nodeData.runId, {
    refetchInterval: runStatus === "running" ? 3000 : false,
  })

  const passed =
    run?.stepResults?.filter((s) => s.result === "PASSED").length ?? 0
  const total = run?.stepResults?.length ?? 0

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-border bg-background">
      {/* Panel header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
        <HugeiconsIcon
          icon={TestTube01Icon}
          size={14}
          color="currentColor"
          strokeWidth={1.5}
          className="shrink-0 text-muted-foreground"
        />
        <span className="flex-1 truncate text-xs font-medium text-foreground">
          {nodeData.name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 text-muted-foreground"
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
          />
        </Button>
      </div>

      {/* Summary bar */}
      {run && (
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2.5">
          <Badge
            variant={
              run.status === "PASSED"
                ? "secondary"
                : run.status === "FAILED"
                  ? "destructive"
                  : "outline"
            }
            className="text-xs"
          >
            {run.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {passed}/{total} passed
          </span>
          {run.finishedAt && run.createdAt && (
            <span className="ml-auto text-xs text-muted-foreground">
              {(
                (new Date(run.finishedAt).getTime() -
                  new Date(run.createdAt).getTime()) /
                1000
              ).toFixed(1)}
              s
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!nodeData.runId ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-sm text-muted-foreground">
              Run the flow to see step results
            </p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-3">
            <ListSkeleton count={4} className="h-12 rounded-md" />
          </div>
        ) : runStatus === "running" ? (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <span className="size-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            Executing…
          </div>
        ) : run?.stepResults?.length ? (
          <div>
            {run.stepResults.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            No step results
          </div>
        )}
      </div>
    </aside>
  )
}
