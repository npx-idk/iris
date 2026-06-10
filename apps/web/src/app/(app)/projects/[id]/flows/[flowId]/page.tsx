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
  type Node,
  type Edge,
  type OnConnect,
  type ReactFlowInstance,
  type NodeMouseHandler,
  BackgroundVariant,
  Panel,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Tick01Icon,
  Delete02Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { api } from "@/lib/api"
import { useProjectTests } from "@/hooks/queries"
import { useFlowExecution } from "@/hooks/useFlowExecution"
import { TEST_DRAG_MIME } from "@/lib/constants"
import { ROUTES } from "@/lib/routes"
import { Flow } from "@/lib/types"
import {
  NODE_TYPES,
  DEFAULT_EDGE_OPTIONS,
  type TestNodeData,
} from "@/components/flows/TestSuiteNode"
import { NodeDetailsPanel } from "@/components/flows/NodeDetailsPanel"
import { TestLibraryPanel } from "@/components/flows/TestLibraryPanel"
import { Button } from "@iris/ui/components/button"
import { Badge } from "@iris/ui/components/badge"
import { Separator } from "@iris/ui/components/separator"

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

  const { running, runStep, runResult, handleRunFlow } = useFlowExecution({
    flowId,
    setNodes,
    setEdges,
    setSelectedNodeId,
  })

  const { data: flow } = useQuery({
    queryKey: ["flow", flowId],
    queryFn: () => api.get<Flow>(`/flows/${flowId}`),
  })

  const { data: tests = [] } = useProjectTests(projectId)

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
      const testId = e.dataTransfer.getData(TEST_DRAG_MIME)
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
        <TestLibraryPanel tests={tests} />

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
                  Connect them by dragging from one node&apos;s handle to
                  another
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
