"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DragDropVerticalIcon,
  PlayIcon,
  NextIcon,
  PreviousIcon,
  Cancel01Icon,
  Edit01Icon,
} from "@hugeicons/core-free-icons"
import { TestStep, TestRunStep, WorkspaceVariable } from "@/lib/types"
import { StepEditForm } from "./StepEditForm"
import {
  Test,
  TestStatus,
  TestName,
  TestDuration,
  TestError,
  TestErrorMessage,
} from "@iris/ui/components/ai-elements/test-results"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@iris/ui/components/tooltip"

export interface LiveStep {
  instruction: string
  result: "PASSED" | "FAILED" | "RUNNING"
  errorMessage?: string
  durationMs?: number
  stepIndex?: number
}

const shimmerStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 6%) 50%, transparent 100%)",
  backgroundSize: "300px 100%",
  backgroundRepeat: "no-repeat",
  animation: "shimmer 1.5s linear infinite",
}

// ─── SavedStepRow ─────────────────────────────────────────────────────────────

export function SavedStepRow({
  step,
  onDelete,
  onSave,
  dimmed = false,
  replayState = null,
  lastRunStep,
  selected = false,
  onSelect,
  onRunStep,
  onRunTill,
  onRunFrom,
  projectVariables = [],
  onVariableCreated,
}: {
  step: TestStep
  onDelete?: () => void
  onSave?: (instruction: string, description: string) => void
  dimmed?: boolean
  replayState?: "running" | "passed" | "failed" | null
  lastRunStep?: TestRunStep
  selected?: boolean
  onSelect?: () => void
  onRunStep?: () => void
  onRunTill?: () => void
  onRunFrom?: () => void
  projectVariables?: WorkspaceVariable[]
  onVariableCreated?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: dimmed })
  const [editing, setEditing] = useState(false)

  const style = { transform: CSS.Transform.toString(transform), transition }
  const canSelect = !replayState

  if (editing) {
    return (
      <div ref={setNodeRef} style={style}>
        <StepEditForm
          step={step}
          projectVariables={projectVariables}
          onVariableCreated={onVariableCreated}
          onSave={async (instruction, description) => {
            await onSave?.(instruction, description)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const resultStatus =
    replayState === "passed"
      ? "passed"
      : replayState === "failed"
        ? "failed"
        : replayState === "running"
          ? "running"
          : lastRunStep?.result === "PASSED"
            ? "passed"
            : lastRunStep?.result === "FAILED"
              ? "failed"
              : "skipped"

  const rowActions: Array<{
    onClick?: () => void
    icon: typeof PlayIcon
    label: string
    destructive?: boolean
  }> = [
    { onClick: onRunStep, icon: PlayIcon, label: "Run this step" },
    { onClick: onRunTill, icon: NextIcon, label: "Run up to here" },
    { onClick: onRunFrom, icon: PreviousIcon, label: "Run from here" },
    {
      onClick: onDelete,
      icon: Cancel01Icon,
      label: "Delete step",
      destructive: true,
    },
  ]

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...(replayState === "running" ? shimmerStyle : {}) }}
      className={`group border-b transition-colors last:border-b-0 ${
        selected ? "bg-primary/5" : ""
      } ${dimmed ? "bg-muted/10" : selected ? "" : "bg-background hover:bg-muted/20"} ${isDragging ? "z-50 opacity-50 shadow-lg" : ""}`}
    >
      <Test
        name={step.description || step.instruction}
        status={resultStatus}
        className={`flex items-center gap-3 rounded-none border-none bg-transparent px-4 py-3 ${canSelect ? "cursor-pointer" : ""}`}
        onClick={() => canSelect && onSelect?.()}
      >
        <button
          {...(dimmed ? {} : { ...attributes, ...listeners })}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={`-ml-2 shrink-0 touch-none transition-opacity select-none ${
            dimmed
              ? "pointer-events-none opacity-0"
              : "cursor-grab opacity-0 group-hover:opacity-40 hover:!opacity-100 active:cursor-grabbing"
          }`}
        >
          <HugeiconsIcon
            icon={DragDropVerticalIcon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
          />
        </button>

        {resultStatus !== "skipped" && <TestStatus />}

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="min-w-0 flex-1">
              <TestName
                className={`block truncate text-sm ${dimmed ? "text-muted-foreground" : "font-medium text-foreground/90"}`}
              >
                {step.description || step.instruction}
              </TestName>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {step.instruction}
          </TooltipContent>
        </Tooltip>

        {!replayState && (
          <div
            className="relative flex shrink-0 items-center justify-end"
            style={{ minWidth: "3rem" }}
          >
            <div className="pointer-events-none absolute right-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
              {onSave && !dimmed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(true)
                      }}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <HugeiconsIcon
                        icon={Edit01Icon}
                        size={12}
                        color="currentColor"
                        strokeWidth={1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Edit step
                  </TooltipContent>
                </Tooltip>
              )}
              {rowActions.map(
                ({ onClick, icon, label, destructive }) =>
                  onClick && (
                    <Tooltip key={label}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onClick()
                          }}
                          className={`rounded p-1 transition-colors hover:bg-accent ${destructive ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <HugeiconsIcon
                            icon={icon}
                            size={12}
                            color="currentColor"
                            strokeWidth={1.5}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  )
              )}
            </div>
          </div>
        )}
      </Test>
    </div>
  )
}

// ─── LiveStepCard ─────────────────────────────────────────────────────────────

export function LiveStepCard({ step }: { step: LiveStep }) {
  const status =
    step.result === "PASSED"
      ? "passed"
      : step.result === "FAILED"
        ? "failed"
        : "running"

  return (
    <Test
      name={step.instruction}
      status={status}
      duration={step.durationMs}
      className="flex-col items-stretch gap-2 border-b border-border/40 bg-background px-4 py-3 last:border-b-0"
      style={step.result === "RUNNING" ? shimmerStyle : {}}
    >
      <div className="flex items-center gap-3">
        <TestStatus />
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="min-w-0 flex-1">
              <TestName className="block cursor-default truncate text-sm text-card-foreground">
                {step.instruction}
              </TestName>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {step.instruction}
          </TooltipContent>
        </Tooltip>
        {step.durationMs !== undefined && <TestDuration />}
      </div>
      {step.errorMessage && (
        <TestError className="mt-0 ml-7">
          <TestErrorMessage>{step.errorMessage}</TestErrorMessage>
        </TestError>
      )}
    </Test>
  )
}
