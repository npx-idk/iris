"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"

const ReportSheet = dynamic(
  () => import("@/components/tests/ReportSheet").then((mod) => mod.ReportSheet),
  { ssr: false }
)
import { api } from "@/lib/api"
import {
  TestWithSteps,
  BrowserTab,
  TestRun,
  TestRunStep,
  WorkspaceVariable,
} from "@/lib/types"
import { ROUTES } from "@/lib/routes"
import { PrerequisiteManager } from "@/components/tests/PrerequisiteManager"
import { BrowserPanel } from "@/components/tests/BrowserPanel"
import { StepsPanel } from "@/components/tests/StepsPanel"
import { type LiveStep } from "@/components/tests/StepRows"
import { EditTestSheet } from "@/components/tests/EditTestSheet"
import { useAuthorSession } from "@/hooks/useAuthorSession"
import { useSocketSession } from "@/hooks/useSocketSession"
import { useCanvasInput } from "@/hooks/useCanvasInput"
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation"
import { useRunExecution } from "@/hooks/useRunExecution"
import { useStepManagement } from "@/hooks/useStepManagement"
import { useBrowserDevtools } from "@/hooks/useBrowserDevtools"
import { Button } from "@iris/ui/components/button"
import { Badge } from "@iris/ui/components/badge"
import { Label } from "@iris/ui/components/label"
import { Separator } from "@iris/ui/components/separator"
import { SidebarTrigger } from "@iris/ui/components/sidebar"
import { Switch } from "@iris/ui/components/animate-ui/components/radix/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@iris/ui/components/select"
import { useTheme } from "next-themes"

type Tab = "steps" | "prerequisites"

export default function TestPage() {
  const { id: testId } = useParams<{ id: string }>()
  const { resolvedTheme } = useTheme()

  const { data: test, refetch } = useQuery({
    queryKey: ["test", testId],
    queryFn: () => api.get<TestWithSteps>(`/tests/${testId}`),
  })

  const { data: project } = useQuery({
    queryKey: ["project", test?.projectId],
    queryFn: () => api.get<any>(`/projects/${test?.projectId}`),
    enabled: !!test?.projectId,
  })

  const { data: workspaceVariables = [], refetch: refetchVariables } = useQuery(
    {
      queryKey: ["workspace-variables"],
      queryFn: () => api.get<WorkspaceVariable[]>("/workspace/variables"),
    }
  )

  const lastRunId = test?.runs?.find(
    (r) => r.status === "PASSED" || r.status === "FAILED"
  )?.id
  const { data: lastRunDetails } = useQuery({
    queryKey: ["run", lastRunId],
    queryFn: () => api.get<TestRun>(`/runs/${lastRunId}`),
    enabled: !!lastRunId,
  })
  const lastRunStepMap = new Map<string, TestRunStep>(
    (lastRunDetails?.stepResults ?? [])
      .filter((s) => s.testStepId)
      .map((s) => [s.testStepId!, s])
  )

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const { data: selectedRunDetails } = useQuery({
    queryKey: ["run", selectedRunId],
    queryFn: () => api.get<TestRun>(`/runs/${selectedRunId}`),
    enabled: !!selectedRunId,
  })
  const selectedRunStepMap =
    selectedRunId && selectedRunDetails
      ? new Map<string, TestRunStep>(
          (selectedRunDetails.stepResults ?? [])
            .filter((s) => s.testStepId)
            .map((s) => [s.testStepId!, s])
        )
      : null

  const activeStepMap = selectedRunStepMap ?? lastRunStepMap
  const activeRunId = selectedRunId ?? lastRunId ?? null

  const { data: runEvents } = useQuery({
    queryKey: ["run-events", activeRunId],
    queryFn: () => api.get<any>(`/runs/${activeRunId}/events`),
    enabled: !!activeRunId,
  })

  const [tab, setTab] = useState<Tab>("steps")
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  )
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  const allStepsForLookup = [
    ...(test?.prerequisites ?? []).flatMap((p) => p.steps),
    ...(test?.steps ?? []),
  ]
  const selectedStep = selectedStepId
    ? allStepsForLookup.find((s) => s.id === selectedStepId)
    : undefined
  const selectedRunStep = selectedStepId
    ? activeStepMap.get(selectedStepId)
    : undefined

  function toggleSection(id: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Authoring session ───────────────────────────────────────────────────────

  const {
    sessionState,
    setSessionState,
    statusLabel,
    setStatusLabel,
    sessionId,
    setSessionId,
    sessionIdRef,
    ensureSession,
  } = useAuthorSession(testId)

  const [instruction, setInstruction] = useState("")
  const [stepRunning, setStepRunning] = useState(false)
  const [liveSteps, setLiveSteps] = useState<LiveStep[]>([])
  const [replayPos, setReplayPos] = useState<number | null>(null)
  const [replayResults, setReplayResults] = useState<Record<number, boolean>>(
    {}
  )

  const devtools = useBrowserDevtools()
  const consoleEndRef = useRef<HTMLDivElement>(null)
  const sessionStartRef = useRef<number>(0)

  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([])
  const [interactiveMode, setInteractiveMode] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const urlFocusedRef = useRef(false)
  const urlBarRef = useRef<HTMLInputElement>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stepsEndRef = useRef<HTMLDivElement>(null)
  const pendingInstructionRef = useRef<string | null>(null)

  // ── Hooks ────────────────────────────────────────────────────────────────────

  const canvasHandlers = useCanvasInput(
    sessionIdRef,
    sessionState,
    interactiveMode,
    canvasRef
  )

  useEffect(() => {
    if (!interactiveMode) {
      canvasHandlers.isDraggingRef.current = false
      canvasRef.current?.blur()
    }
  }, [interactiveMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const nav = useBrowserNavigation(sessionId)
  const run = useRunExecution(canvasRef, refetch)
  const steps = useStepManagement(testId, test, refetch)

  // ── Socket session ──────────────────────────────────────────────────────────

  useSocketSession(sessionId, {
    onFrame: (frameBase64) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      const img = new Image()
      img.onload = () => ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = `data:image/jpeg;base64,${frameBase64}`
    },
    onAuthorReady: () => {
      setSessionState("ready")
      setStatusLabel("")
      setReplayPos(null)
      setReplayResults({})
    },
    onStepStarted: (pos) => setReplayPos(pos),
    onStepCompleted: (pos, passed) =>
      setReplayResults((prev) => ({ ...prev, [pos]: passed })),
    onTabsUpdate: (tabs) => {
      setBrowserTabs(tabs)
      const active = tabs.find((t) => t.active)
      if (active && !urlFocusedRef.current) setUrlInput(active.url)
    },
    onBrowserEvent: devtools.handleBrowserEvent,
  })

  // ── Side effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [liveSteps.length])

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [devtools.consoleEntries.length])

  useEffect(() => {
    if (sessionState !== "ready" || !pendingInstructionRef.current) return
    const instr = pendingInstructionRef.current
    pendingInstructionRef.current = null
    handleRunStep(instr)
  }, [sessionState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Author actions ───────────────────────────────────────────────────────────

  async function seek(opts: {
    fromFlatPos?: number
    toFlatPos?: number
    navigate?: boolean
    label?: string
  }) {
    if (!sessionId) return
    setSessionState("warming")
    setStatusLabel(opts.label ?? "Replaying…")
    setLiveSteps([])
    setReplayPos(null)
    setReplayResults({})
    try {
      const body: Record<string, unknown> = {}
      if (opts.fromFlatPos !== undefined) body.fromFlatPos = opts.fromFlatPos
      if (opts.toFlatPos !== undefined) body.toFlatPos = opts.toFlatPos
      if (opts.navigate !== undefined) body.navigate = opts.navigate
      await api.post(`/author/${sessionId}/seek`, body)
    } catch {
      setSessionState("ready")
      setStatusLabel("")
    }
  }

  async function handleRunStep(overrideInstruction?: string) {
    const instr = (overrideInstruction ?? instruction).trim()
    if (!sessionId || !instr || stepRunning || sessionState !== "ready") return
    if (!overrideInstruction) setInstruction("")
    setStepRunning(true)
    setLiveSteps((prev) => [...prev, { instruction: instr, result: "RUNNING" }])
    try {
      const res = await api.post<{
        result: "PASSED" | "FAILED"
        errorMessage?: string
        durationMs: number
        stepIndex: number
      }>(`/author/${sessionId}/step`, { instruction: instr })
      setLiveSteps((prev) =>
        prev.map((s, i) =>
          i === prev.length - 1
            ? {
                ...s,
                result: res.result,
                errorMessage: res.errorMessage,
                durationMs: res.durationMs,
                stepIndex: res.stepIndex,
              }
            : s
        )
      )
      if (res.result === "PASSED") {
        await refetch()
        setLiveSteps((prev) => prev.filter((s) => s.result !== "PASSED"))
      }
    } catch (err: any) {
      setLiveSteps((prev) =>
        prev.map((s, i) =>
          i === prev.length - 1
            ? {
                ...s,
                result: "FAILED",
                errorMessage:
                  err?.response?.data?.message ??
                  err?.message ??
                  "Request failed",
              }
            : s
        )
      )
    } finally {
      setStepRunning(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return
    e.preventDefault()
    if (e.metaKey || e.ctrlKey) {
      const instr = instruction.trim()
      if (!instr || !sessionId) return
      if (existingSteps.length === 0 && prerequisites.length === 0) {
        handleRunStep()
      } else {
        pendingInstructionRef.current = instr
        setInstruction("")
        seek({ label: "Replaying all steps…" })
      }
    } else {
      handleRunStep()
    }
  }

  const [launching, setLaunching] = useState(false)

  function handleStartBrowser() {
    ensureSession((_, initialTabs) => {
      devtools.clearNetwork()
      devtools.clearConsole()
      setBrowserTabs(initialTabs)
      setInteractiveMode(false)
      sessionStartRef.current = Date.now()
    })
  }

  function handleCloseSession() {
    if (sessionIdRef.current) {
      api.delete(`/author/${sessionIdRef.current}`).catch(() => {})
      sessionIdRef.current = null
      setSessionId(null)
    }
    setSessionState("idle")
    setStatusLabel("")
    setLiveSteps([])
    setReplayPos(null)
    setReplayResults({})
  }

  async function handleToggleContinueOnFailure(value: boolean) {
    await api.patch(`/tests/${testId}`, { continueOnFailure: value })
    refetch()
  }

  const [editOpen, setEditOpen] = useState(false)

  async function handleRunTest() {
    if (sessionIdRef.current) {
      api.delete(`/author/${sessionIdRef.current}`).catch(() => {})
      sessionIdRef.current = null
      setSessionId(null)
      setSessionState("idle")
    }
    setSelectedRunId(null)
    setLaunching(true)
    try {
      const { runId } = await api.post<{ runId: string }>(
        `/tests/${testId}/runs`
      )
      run.startRun(runId)
      setTab("steps")
    } finally {
      setLaunching(false)
    }
  }

  const [reportOpen, setReportOpen] = useState(false)
  const activeRun = selectedRunId ? selectedRunDetails : lastRunDetails

  // ── Derived state ────────────────────────────────────────────────────────────

  const isReady = sessionState === "ready"
  const isBusy =
    sessionState === "starting" || sessionState === "warming" || stepRunning
  const existingSteps = test?.steps ?? []
  const prerequisites = test?.prerequisites ?? []
  const hasContent = existingSteps.length > 0 || prerequisites.length > 0
  const prereqStepCount = prerequisites.reduce(
    (sum, p) => sum + p.steps.length,
    0
  )
  const passedCount = run.runSteps.filter((s) => s.result === "PASSED").length

  function getReplayState(
    flatPos: number
  ): "running" | "passed" | "failed" | null {
    if (sessionState === "warming") {
      if (replayPos === flatPos) return "running"
      if (flatPos in replayResults)
        return replayResults[flatPos] ? "passed" : "failed"
      return null
    }
    if (run.runMode) {
      const completed = run.runSteps[flatPos]
      if (completed) return completed.result === "PASSED" ? "passed" : "failed"
      if (
        (run.runStatus === "QUEUED" || run.runStatus === "RUNNING") &&
        flatPos === run.runSteps.length
      )
        return "running"
      return null
    }
    return null
  }

  const tabDefs: { key: Tab; label: string }[] = [
    { key: "steps", label: `Steps (${existingSteps.length})` },
    { key: "prerequisites", label: `Prerequisites (${prerequisites.length})` },
  ]

  const allRuns = test?.runs ?? []

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full min-w-0 flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {test && (
            <>
              <Link
                href={ROUTES.projectTests(test.projectId)}
                className="shrink-0 transition-colors hover:text-foreground"
              >
                Tests
              </Link>
              <span className="shrink-0">/</span>
            </>
          )}
          <span className="truncate font-medium text-foreground">
            {test?.name ?? "…"}
          </span>
          {test && !test.enabled && (
            <Badge
              variant="outline"
              className="shrink-0 text-xs text-muted-foreground"
            >
              disabled
            </Badge>
          )}
          {test && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setEditOpen(true)}
              className="shrink-0 text-xs text-muted-foreground"
            >
              Edit
            </Button>
          )}
        </nav>
      </header>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/80 px-4 py-2 shadow-sm backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {allRuns.length > 0 && !run.runMode && (
            <Select
              value={selectedRunId ?? "latest"}
              onValueChange={(v) => setSelectedRunId(v === "latest" ? null : v)}
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

          {run.runMode &&
            (run.runStatus === "RUNNING" || run.runStatus === "QUEUED") && (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Running…
              </span>
            )}
          {run.runMode &&
            run.runStatus &&
            run.runStatus !== "RUNNING" &&
            run.runStatus !== "QUEUED" && (
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {passedCount}/{run.runSteps.length} passed
                </span>
                <Badge
                  variant={
                    run.runStatus === "PASSED" ? "secondary" : "destructive"
                  }
                  className="text-xs"
                >
                  {run.runStatus}
                </Badge>
              </span>
            )}

          {!run.runMode && isBusy && statusLabel && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              {statusLabel}
            </span>
          )}
          {!run.runMode && isReady && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Live
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!run.runMode && isReady && hasContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => seek({ label: "Replaying all steps…" })}
            >
              Start over
            </Button>
          )}
          {!run.runMode && sessionState !== "idle" && (
            <Button variant="ghost" size="sm" onClick={handleCloseSession}>
              ✕ Close browser
            </Button>
          )}
          {!run.runMode && (
            <div className="flex items-center gap-2">
              <Switch
                id="continue-on-failure"
                checked={test?.continueOnFailure ?? false}
                onCheckedChange={handleToggleContinueOnFailure}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportOpen(true)}
            >
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
            onClick={handleRunTest}
            disabled={
              run.runMode ||
              launching ||
              !test?.enabled ||
              existingSteps.length === 0
            }
            size="sm"
          >
            {launching ? "Starting…" : "▶ Run test"}
          </Button>
        </div>
      </div>

      {selectedRunId && selectedRunId !== lastRunId && !run.runMode && (
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-4 py-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            Viewing run from{" "}
            {selectedRunDetails
              ? new Date(selectedRunDetails.createdAt).toLocaleString()
              : "…"}
            {selectedRunDetails && (
              <>
                {" "}
                ·{" "}
                <span
                  className={
                    selectedRunDetails.status === "PASSED"
                      ? "text-primary"
                      : "text-destructive"
                  }
                >
                  {selectedRunDetails.status}
                </span>{" "}
                · {selectedRunDetails.passedSteps}/
                {selectedRunDetails.totalSteps} steps
              </>
            )}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setSelectedRunId(null)}
            className="shrink-0 text-xs text-muted-foreground"
          >
            ✕ Back to latest
          </Button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className="flex w-[460px] shrink-0 flex-col border-r border-border">
          <div className="flex shrink-0 border-b border-border px-4">
            {tabDefs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`mr-4 border-b-2 px-1 py-[13px] text-xs font-medium transition-colors ${
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "steps" && (
            <StepsPanel
              test={test}
              existingSteps={existingSteps}
              prerequisites={prerequisites}
              liveSteps={liveSteps}
              collapsedSections={collapsedSections}
              onToggleSection={toggleSection}
              isReady={isReady}
              hasContent={hasContent}
              prereqStepCount={prereqStepCount}
              getReplayState={getReplayState}
              sessionState={sessionState}
              statusLabel={statusLabel}
              isBusy={run.runMode || isBusy}
              instruction={instruction}
              stepRunning={stepRunning}
              stepsEndRef={stepsEndRef}
              onInstructionChange={setInstruction}
              onKeyDown={handleKeyDown}
              onFocus={handleStartBrowser}
              onRunStep={handleRunStep}
              onSeek={seek}
              onDeleteStep={run.runMode ? undefined : steps.handleDeleteStep}
              onSaveStep={run.runMode ? undefined : steps.handleSaveStep}
              onReorderSteps={run.runMode ? () => {} : steps.handleReorderSteps}
              lastRunStepMap={activeStepMap}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
              projectVariables={workspaceVariables}
              onVariableCreated={() => refetchVariables()}
            />
          )}

          {tab === "prerequisites" && test && (
            <div className="flex-1 overflow-y-auto p-4">
              <PrerequisiteManager test={test} onUpdate={() => refetch()} />
            </div>
          )}
        </div>

        <BrowserPanel
          sessionId={sessionId}
          runActive={run.runMode}
          lastRunId={activeRunId}
          onStartBrowser={handleStartBrowser}
          sessionState={sessionState}
          isBusy={isBusy}
          statusLabel={statusLabel}
          canvasRef={canvasRef}
          canvasHandlers={canvasHandlers}
          interactiveMode={interactiveMode}
          onInteractiveModeChange={setInteractiveMode}
          browserTabs={browserTabs}
          onActivateTab={(id) => {
            nav.handleActivateTab(id)
            setBrowserTabs((prev) =>
              prev.map((t) => ({ ...t, active: t.targetId === id }))
            )
          }}
          onCloseTab={nav.handleCloseTab}
          urlInput={urlInput}
          urlFocusedRef={urlFocusedRef}
          urlBarRef={urlBarRef}
          onUrlChange={setUrlInput}
          onNavigate={nav.navigate}
          onBack={nav.goBack}
          onForward={nav.goForward}
          onReload={nav.reload}
          networkEntries={devtools.networkEntries}
          onClearNetwork={devtools.clearNetwork}
          consoleEntries={devtools.consoleEntries}
          onClearConsole={devtools.clearConsole}
          consoleEndRef={consoleEndRef}
          sessionStartRef={sessionStartRef}
          selectedStep={selectedStep}
          selectedRunStep={selectedRunStep}
          onClearSelectedStep={() => setSelectedStepId(null)}
          runEvents={runEvents ?? null}
        />
      </div>

      <EditTestSheet
        test={test}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={refetch}
      />

      <ReportSheet
        isOpen={reportOpen}
        onOpenChange={setReportOpen}
        test={test}
        activeRun={activeRun}
        resolvedTheme={resolvedTheme}
        project={project}
      />
    </div>
  )
}
