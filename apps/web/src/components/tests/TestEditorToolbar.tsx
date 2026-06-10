"use client"

import { RunStatus, TestWithSteps } from "@/lib/types"
import { SessionState } from "@/hooks/useAuthorSession"
import { Button } from "@iris/ui/components/button"
import { Badge } from "@iris/ui/components/badge"
import { Label } from "@iris/ui/components/label"
import { Switch } from "@iris/ui/components/animate-ui/components/radix/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@iris/ui/components/select"

interface TestEditorToolbarProps {
  test: TestWithSteps | undefined
  // Run picker
  selectedRunId: string | null
  onSelectRun: (id: string | null) => void
  // Execution state (from useRunExecution)
  runMode: boolean
  runStatus: RunStatus | null
  runStepsCount: number
  passedCount: number
  // Authoring session state
  sessionState: SessionState
  isReady: boolean
  isBusy: boolean
  statusLabel: string
  hasContent: boolean
  // Actions
  activeRunId: string | null
  launching: boolean
  onSeekAll: () => void
  onCloseSession: () => void
  onToggleContinueOnFailure: (v: boolean) => void
  onOpenReport: () => void
  onRunTest: () => void
}

/** Status indicators + actions row of the test editor (run picker, live state, run/report buttons). */
export function TestEditorToolbar({
  test,
  selectedRunId,
  onSelectRun,
  runMode,
  runStatus,
  runStepsCount,
  passedCount,
  sessionState,
  isReady,
  isBusy,
  statusLabel,
  hasContent,
  activeRunId,
  launching,
  onSeekAll,
  onCloseSession,
  onToggleContinueOnFailure,
  onOpenReport,
  onRunTest,
}: TestEditorToolbarProps) {
  const allRuns = test?.runs ?? []
  const existingStepCount = test?.steps?.length ?? 0

  return (
    <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/80 px-4 py-2 shadow-sm backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {allRuns.length > 0 && !runMode && (
          <Select
            value={selectedRunId ?? "latest"}
            onValueChange={(v) => onSelectRun(v === "latest" ? null : v)}
          >
            <SelectTrigger className="">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest run</SelectItem>
              {allRuns.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        r.status === "PASSED"
                          ? "text-primary"
                          : r.status === "FAILED"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {r.status}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {runMode && (runStatus === "RUNNING" || runStatus === "QUEUED") && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            Running…
          </span>
        )}
        {runMode &&
          runStatus &&
          runStatus !== "RUNNING" &&
          runStatus !== "QUEUED" && (
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {passedCount}/{runStepsCount} passed
              </span>
              <Badge
                variant={runStatus === "PASSED" ? "secondary" : "destructive"}
                className="text-xs"
              >
                {runStatus}
              </Badge>
            </span>
          )}

        {!runMode && isBusy && statusLabel && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            {statusLabel}
          </span>
        )}
        {!runMode && isReady && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-primary">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Live
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!runMode && isReady && hasContent && (
          <Button variant="ghost" size="sm" onClick={onSeekAll}>
            Start over
          </Button>
        )}
        {!runMode && sessionState !== "idle" && (
          <Button variant="ghost" size="sm" onClick={onCloseSession}>
            ✕ Close browser
          </Button>
        )}
        {!runMode && (
          <div className="flex items-center gap-2">
            <Switch
              id="continue-on-failure"
              checked={test?.continueOnFailure ?? false}
              onCheckedChange={onToggleContinueOnFailure}
            />
            <Label
              htmlFor="continue-on-failure"
              className="cursor-pointer text-xs text-muted-foreground select-none"
            >
              Continue on fail
            </Label>
          </div>
        )}
        {activeRunId && (
          <Button variant="outline" size="sm" onClick={onOpenReport}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1.5 h-3.5 w-3.5"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Report
          </Button>
        )}
        <Button
          onClick={onRunTest}
          disabled={
            runMode || launching || !test?.enabled || existingStepCount === 0
          }
          size="sm"
        >
          {launching ? "Starting…" : "▶ Run test"}
        </Button>
      </div>
    </div>
  )
}
