"use client"

import { useRef, useState } from "react"
import type { Edge, Node } from "@xyflow/react"
import { api } from "@/lib/api"
import { RunStatus } from "@/lib/types"
import type {
  NodeRunStatus,
  TestNodeData,
} from "@/components/flows/TestSuiteNode"

async function pollRunStatus(
  runId: string,
  signal: AbortSignal
): Promise<RunStatus> {
  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, 2000))
    if (signal.aborted) break
    const run = await api.get<{ status: RunStatus }>(`/runs/${runId}`)
    if (run.status !== "RUNNING" && run.status !== "QUEUED") return run.status
  }
  return "CANCELLED"
}

interface UseFlowExecutionArgs {
  flowId: string
  setNodes: (updater: (nodes: Node[]) => Node[]) => void
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void
  /** Auto-opens the currently executing node in the details panel. */
  setSelectedNodeId: (nodeId: string | null) => void
}

/**
 * Drives a flow run: enqueues all node runs on the API, then walks them in
 * order, polling each run and reflecting progress on the canvas nodes/edges.
 * Calling `handleRunFlow` while running aborts instead.
 */
export function useFlowExecution({
  flowId,
  setNodes,
  setEdges,
  setSelectedNodeId,
}: UseFlowExecutionArgs) {
  const [running, setRunning] = useState(false)
  const [runStep, setRunStep] = useState<{
    current: number
    total: number
  } | null>(null)
  const [runResult, setRunResult] = useState<"passed" | "failed" | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function updateNodeData(nodeId: string, patch: Partial<TestNodeData>) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  function resetRunStatuses(status: NodeRunStatus = "idle") {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, runStatus: status, runId: undefined },
      }))
    )
  }

  async function handleRunFlow() {
    if (running) {
      abortRef.current?.abort()
      return
    }

    const abort = new AbortController()
    abortRef.current = abort
    setRunning(true)
    setRunResult(null)
    resetRunStatuses("waiting")

    let flowPassed = true

    try {
      const { runs } = await api.post<{
        runs: { nodeId: string; runId: string }[]
      }>(`/flows/${flowId}/runs`)
      setRunStep({ current: 0, total: runs.length })

      // Associate runs to nodes and mark them as waiting
      for (const { nodeId, runId } of runs) {
        updateNodeData(nodeId, { runId, runStatus: "waiting" })
      }

      for (let i = 0; i < runs.length; i++) {
        if (abort.signal.aborted) {
          flowPassed = false
          // Cancel remaining runs on the API
          for (let j = i; j < runs.length; j++) {
            updateNodeData(runs[j]!.nodeId, { runStatus: "idle" })
            api.post(`/runs/${runs[j]!.runId}/cancel`).catch(() => {})
          }
          break
        }

        const { nodeId, runId } = runs[i]!
        updateNodeData(nodeId, { runStatus: "running" })
        setRunStep({ current: i + 1, total: runs.length })
        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            animated: e.source === nodeId || e.target === nodeId,
          }))
        )

        // Auto-open the running node in the panel
        setSelectedNodeId(nodeId)

        const status = await pollRunStatus(runId, abort.signal)
        const nodeStatus: NodeRunStatus =
          status === "PASSED" ? "passed" : "failed"
        updateNodeData(nodeId, { runStatus: nodeStatus })

        setEdges((eds) => eds.map((e) => ({ ...e, animated: false })))

        if (status !== "PASSED") {
          flowPassed = false
          // Mark remaining nodes as cancelled/idle and trigger cancellation if aborted/cancelled
          for (let j = i + 1; j < runs.length; j++) {
            updateNodeData(runs[j]!.nodeId, { runStatus: "idle" })
            if (abort.signal.aborted || status === "CANCELLED") {
              api.post(`/runs/${runs[j]!.runId}/cancel`).catch(() => {})
            }
          }
          break
        }
      }
    } catch (err) {
      console.error("Flow execution failed", err)
      flowPassed = false
      resetRunStatuses("failed")
    } finally {
      // Clear waiting state from any skipped nodes
      setNodes((nds) =>
        nds.map((n) =>
          (n.data as TestNodeData).runStatus === "waiting"
            ? { ...n, data: { ...n.data, runStatus: "idle" } }
            : n
        )
      )
      setRunning(false)
      setRunStep(null)
      setRunResult(flowPassed ? "passed" : "failed")
    }
  }

  return { running, runStep, runResult, handleRunFlow }
}
