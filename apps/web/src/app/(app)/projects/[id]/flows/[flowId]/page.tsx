"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type OnConnect,
  type ReactFlowInstance,
  type NodeMouseHandler,
  Handle,
  Position,
  BackgroundVariant,
  Panel,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Tick01Icon,
  TestTube01Icon,
  Delete02Icon,
  PlayIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { Test, Flow, RunStatus, TestRun, TestRunStep } from "@/lib/types"
import {
  nodeRunStatusRing,
  nodeRunStatusDot,
  nodeRunStatusText,
} from "@/lib/run-status"
import { Button } from "@iris/ui/components/button"
import { Badge } from "@iris/ui/components/badge"
import { Separator } from "@iris/ui/components/separator"
import { Skeleton } from "@iris/ui/components/skeleton"

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeRunStatus = "idle" | "waiting" | "running" | "passed" | "failed"

type TestNodeData = {
  testId: string
  name: string
  stepCount: number
  runStatus?: NodeRunStatus
  runId?: string
}

// ── Custom node ───────────────────────────────────────────────────────────────

const STATUS_RING = nodeRunStatusRing as Record<NodeRunStatus, string>
const STATUS_DOT = nodeRunStatusDot as Record<NodeRunStatus, string>

function TestSuiteNode({
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

const NODE_TYPES = { testSuite: TestSuiteNode }
const DEFAULT_EDGE_OPTIONS = {
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { strokeWidth: 2 },
}

// ── Step result row ───────────────────────────────────────────────────────────

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

// ── Node details panel ────────────────────────────────────────────────────────

function NodeDetailsPanel({
  nodeData,
  onClose,
}: {
  nodeData: TestNodeData
  onClose: () => void
}) {
  const runStatus = nodeData.runStatus ?? "idle"
  const { data: run, isLoading } = useQuery({
    queryKey: ["run", nodeData.runId],
    queryFn: () => api.get<TestRun>(`/runs/${nodeData.runId}`),
    enabled: !!nodeData.runId,
    refetchInterval: runStatus === "running" ? 3000 : false,
  })

  const passed =
    run?.stepResults?.filter((s) => s.result === "PASSED").length ?? 0
  const failed =
    run?.stepResults?.filter((s) => s.result === "FAILED").length ?? 0
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
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlowEditorPage() {
  const { id: projectId, flowId } = useParams<{ id: string; flowId: string }>()
  const router = useRouter()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [flowName, setFlowName] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // Selected node for detail panel
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNodeData = nodes.find((n) => n.id === selectedNodeId)?.data as
    | TestNodeData
    | undefined

  // Run state
  const [running, setRunning] = useState(false)
  const [runStep, setRunStep] = useState<{
    current: number
    total: number
  } | null>(null)
  const [runResult, setRunResult] = useState<"passed" | "failed" | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { data: flow } = useQuery({
    queryKey: ["flow", flowId],
    queryFn: () => api.get<Flow>(`/flows/${flowId}`),
  })

  const { data: tests = [] } = useQuery({
    queryKey: ["tests", projectId],
    queryFn: () => api.get<Test[]>(`/projects/${projectId}/tests`),
  })

  useEffect(() => {
    if (!flow) return
    setFlowName(flow.name)
    if (flow.nodes?.length) setNodes(flow.nodes as Node[])
    if (flow.edges?.length) setEdges(flow.edges as Edge[])
  }, [flow, setNodes, setEdges])

  const onConnect: OnConnect = useCallback(
    (params) =>
      setEdges((eds) => addEdge({ ...params, ...DEFAULT_EDGE_OPTIONS }, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const testId = e.dataTransfer.getData("application/iris-test")
      if (!testId || !rfInstance || !reactFlowWrapper.current) return
      const test = tests.find((t) => t.id === testId)
      if (!test) return
      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      })
      setNodes((nds) => [
        ...nds,
        {
          id: `${testId}-${Date.now()}`,
          type: "testSuite",
          position,
          data: { testId, name: test.name, stepCount: test._count?.steps ?? 0 },
        },
      ])
    },
    [rfInstance, tests, setNodes]
  )

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
  }, [])

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
    let runsList: { nodeId: string; runId: string }[] = []

    try {
      const { runs } = await api.post<{
        runs: { nodeId: string; runId: string }[]
      }>(`/flows/${flowId}/runs`)
      runsList = runs
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
      console.error(err)
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

  async function handleSave() {
    if (!rfInstance) return
    setSaving(true)
    try {
      const { nodes: n, edges: e } = rfInstance.toObject()
      await api.patch(`/flows/${flowId}`, { nodes: n, edges: e })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleRenameFlow() {
    if (!flowName.trim()) return
    await api.patch(`/flows/${flowId}`, { name: flowName.trim() })
    setEditingName(false)
  }

  function deleteSelectedNodes() {
    const deletedIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
    if (selectedNodeId && deletedIds.has(selectedNodeId))
      setSelectedNodeId(null)
    setNodes((nds) => nds.filter((n) => !n.selected))
    setEdges((eds) =>
      eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target))
    )
  }

  const selectedCount = nodes.filter((n) => n.selected).length

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => router.push(ROUTES.projectFlows(projectId))}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
          />
          Flows
        </Button>
        <Separator orientation="vertical" className="h-4" />

        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleRenameFlow()
            }}
          >
            <input
              autoFocus
              className="w-40 border-b border-primary bg-transparent px-0.5 text-sm font-medium outline-none"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              onBlur={handleRenameFlow}
            />
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingName(true)}
            className="text-sm font-medium text-foreground hover:text-primary"
          >
            {flowName || "Untitled flow"}
          </Button>
        )}

        {runResult && !running && (
          <Badge
            variant={runResult === "passed" ? "secondary" : "destructive"}
            className="text-xs"
          >
            {runResult === "passed" ? "✓ Flow passed" : "✗ Flow failed"}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {running && runStep && (
            <span className="text-xs text-muted-foreground">
              Running {runStep.current} of {runStep.total}…
            </span>
          )}

          {selectedCount > 0 && !running && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={deleteSelectedNodes}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
              Remove {selectedCount}
            </Button>
          )}

          <Button
            size="sm"
            variant={running ? "outline" : "default"}
            onClick={handleRunFlow}
            disabled={nodes.length === 0}
            className={running ? "border-destructive/50 text-destructive" : ""}
          >
            {running ? (
              <>
                <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Stop
              </>
            ) : (
              <>
                <HugeiconsIcon
                  icon={PlayIcon}
                  size={14}
                  color="currentColor"
                  strokeWidth={1.5}
                />
                Run flow
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={saving || running}
          >
            {saved ? (
              <>
                <HugeiconsIcon
                  icon={Tick01Icon}
                  size={14}
                  color="currentColor"
                  strokeWidth={2}
                />
                Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — test library */}
        <aside className="z-10 flex w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-background">
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Test suites
            </p>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {tests.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No tests yet
              </p>
            ) : (
              tests.map((test) => (
                <div
                  key={test.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/iris-test", test.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  className="group flex cursor-grab items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent/50 active:cursor-grabbing"
                >
                  <HugeiconsIcon
                    icon={TestTube01Icon}
                    size={13}
                    color="currentColor"
                    strokeWidth={1.5}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span className="flex-1 truncate text-xs text-foreground">
                    {test.name}
                  </span>
                  <Badge
                    variant="secondary"
                    className="shrink-0 text-xs tabular-nums opacity-0 group-hover:opacity-100"
                  >
                    {test._count?.steps ?? 0}
                  </Badge>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Drag tests onto the canvas
            </p>
          </div>
        </aside>

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="min-w-0 flex-1 bg-muted/20">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            nodeTypes={NODE_TYPES}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={running ? null : ["Backspace", "Delete"]}
            nodesDraggable={!running}
            nodesConnectable={!running}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              className="opacity-40"
            />
            <Controls />
            <MiniMap
              nodeColor={() => "hsl(var(--primary))"}
              maskColor="hsl(var(--background) / 0.7)"
              className="!border-border !bg-background"
            />
            {nodes.length === 0 && (
              <Panel
                position="top-center"
                className="pointer-events-none mt-16 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  Drag test suites from the left panel onto the canvas
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Connect them by dragging from one node's handle to another
                </p>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Right panel — node details */}
        {selectedNodeId && selectedNodeData && (
          <NodeDetailsPanel
            nodeData={selectedNodeData}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}
