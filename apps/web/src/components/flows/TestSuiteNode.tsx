"use client"

import { Handle, Position, MarkerType } from "@xyflow/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { TestTube01Icon } from "@hugeicons/core-free-icons"
import {
  nodeRunStatusRing,
  nodeRunStatusDot,
  nodeRunStatusText,
} from "@/lib/run-status"

export type NodeRunStatus = "idle" | "waiting" | "running" | "passed" | "failed"

export type TestNodeData = {
  testId: string
  name: string
  stepCount: number
  runStatus?: NodeRunStatus
  runId?: string
}

const STATUS_RING = nodeRunStatusRing as Record<NodeRunStatus, string>
const STATUS_DOT = nodeRunStatusDot as Record<NodeRunStatus, string>

export function TestSuiteNode({
  data,
  selected,
}: {
  data: TestNodeData
  selected: boolean
}) {
  const runStatus = data.runStatus ?? "idle"
  return (
    <div
      className={`max-w-[240px] min-w-[180px] cursor-pointer rounded-xl border-2 bg-card shadow-sm transition-all ${STATUS_RING[runStatus]} ${selected ? "ring-2 ring-primary/30" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-primary"
      />
      <div className="px-3 py-2.5">
        <div className="mb-1 flex items-center gap-2">
          <div
            className={`size-2 shrink-0 rounded-full transition-colors ${STATUS_DOT[runStatus]}`}
          />
          <HugeiconsIcon
            icon={TestTube01Icon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="shrink-0 text-muted-foreground"
          />
          <span className="flex-1 truncate text-xs font-medium text-foreground">
            {data.name}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {data.stepCount} {data.stepCount === 1 ? "step" : "steps"}
          </p>
          {(runStatus === "running" ||
            runStatus === "passed" ||
            runStatus === "failed") && (
            <span
              className={`text-xs font-medium ${nodeRunStatusText[runStatus]}`}
            >
              {runStatus === "running"
                ? "Running…"
                : runStatus === "passed"
                  ? "Passed"
                  : "Failed"}
            </span>
          )}
          {data.runId &&
            runStatus !== "running" &&
            runStatus !== "idle" &&
            runStatus !== "waiting" && (
              <span className="text-xs text-muted-foreground">View →</span>
            )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-primary"
      />
    </div>
  )
}

export const NODE_TYPES = { testSuite: TestSuiteNode }

export const DEFAULT_EDGE_OPTIONS = {
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { strokeWidth: 2 },
}
