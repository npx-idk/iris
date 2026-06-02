"use client"

import { RefObject, useState } from "react"
import { TestStep, TestRunStep, RunStatus } from "@/lib/types"
import { runStatusSurface, runStatusText } from "@/lib/run-status"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@iris/ui/components/badge"
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@iris/ui/components/tooltip"

interface RunPanelProps {
  runStatus: RunStatus | null
  runSteps: TestRunStep[]
  runError: string | null
  passedCount: number
  totalRunSteps: number
  existingSteps: TestStep[]
  runStepsEndRef: RefObject<HTMLDivElement | null>
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export function RunPanel({
  runStatus,
  runSteps,
  runError,
  passedCount,
  totalRunSteps,
  existingSteps,
  runStepsEndRef,
}: RunPanelProps) {
  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex-1 overflow-y-auto p-4">
        {runStatus && runStatus !== "QUEUED" && runStatus !== "RUNNING" && (
          <div
            className={`mb-3 rounded-xl border px-4 py-3 ${runStatusSurface[runStatus] ?? "border-destructive/30 bg-destructive/5"}`}
          >
            <p
              className={`text-sm font-medium ${runStatusText[runStatus] ?? "text-destructive"}`}
            >
              {runStatus === "PASSED"
                ? "All steps passed"
                : `${passedCount}/${totalRunSteps} steps passed`}
            </p>
            {runError && (
              <p className="mt-1 text-xs text-muted-foreground">{runError}</p>
            )}
          </div>
        )}

        {/* Completed steps */}
        {runSteps.map((step, i) => (
          <RunStepRow key={step.id ?? i} step={step} />
        ))}

        {/* Currently running step (shimmer) */}
        {(runStatus === "QUEUED" || runStatus === "RUNNING") && (
          <div
            className="mb-1 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 6%) 50%, transparent 100%)",
              backgroundSize: "300px 100%",
              backgroundRepeat: "no-repeat",
              animation: "shimmer 1.5s linear infinite",
            }}
          >
            <div className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
            <span className="flex-1 truncate text-sm text-card-foreground">
              {existingSteps[runSteps.length]?.description ||
                existingSteps[runSteps.length]?.instruction ||
                "Running…"}
            </span>
          </div>
        )}

        {/* Queued steps */}
        {(runStatus === "QUEUED" || runStatus === "RUNNING") &&
          existingSteps.slice(runSteps.length + 1).map((step) => (
            <div
              key={step.id}
              className="mb-1 flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 opacity-40"
            >
              <div className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
              <span className="flex-1 truncate text-sm text-muted-foreground">
                {step.description || step.instruction}
              </span>
            </div>
          ))}

        {runSteps.length === 0 &&
          (runStatus === "QUEUED" || runStatus === "RUNNING") &&
          existingSteps.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Starting run…
            </p>
          )}
        <div ref={runStepsEndRef} />
      </div>
    </TooltipProvider>
  )
}

function RunStepRow({ step }: { step: TestRunStep }) {
  const [expanded, setExpanded] = useState(false)
  const passed = step.result === "PASSED"
  const failed = step.result === "FAILED"

  return (
    <div
      className={`mb-1 overflow-hidden rounded-xl border bg-card ${failed ? "border-destructive/40" : "border-border"}`}
    >
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 select-none"
        onClick={() => step.screenshotUrl && setExpanded((v) => !v)}
      >
        <div
          className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
            passed
              ? "bg-primary"
              : failed
                ? "bg-destructive"
                : "bg-muted-foreground/40"
          }`}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 flex-1 truncate text-sm text-card-foreground">
              {step.description || step.instruction}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {step.instruction}
          </TooltipContent>
        </Tooltip>

        <div className="flex shrink-0 items-center gap-2">
          {step.durationMs !== undefined && (
            <span className="text-xs text-muted-foreground">
              {step.durationMs}ms
            </span>
          )}
          <Badge
            variant={passed ? "secondary" : "destructive"}
            className="text-xs"
          >
            {step.result}
          </Badge>
          {step.screenshotUrl && (
            <HugeiconsIcon
              icon={expanded ? ArrowDown01Icon : ArrowRight01Icon}
              size={12}
              color="currentColor"
              strokeWidth={1.5}
            />
          )}
        </div>
      </div>

      {step.errorMessage && !expanded && (
        <p className="-mt-1 bg-destructive/10 px-4 pb-3 text-xs text-destructive">
          {step.errorMessage}
        </p>
      )}

      {expanded && step.screenshotUrl && (
        <div className="space-y-2 px-4 pb-4">
          {step.errorMessage && (
            <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {step.errorMessage}
            </p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              step.screenshotUrl.startsWith("http")
                ? step.screenshotUrl
                : `${apiBase}${step.screenshotUrl}`
            }
            alt="Step screenshot"
            className="w-full rounded-lg border border-border"
          />
        </div>
      )}
    </div>
  )
}
