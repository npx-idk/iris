'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TestWithSteps, BrowserTab, RunStatus, TestRun, TestRunStep, BrowserEventLog, WorkspaceVariable } from '@/lib/types'
import { ROUTES } from '@/lib/routes'
import { PrerequisiteManager } from '@/components/tests/PrerequisiteManager'
import { BrowserPanel } from '@/components/tests/BrowserPanel'
import { StepsPanel } from '@/components/tests/StepsPanel'
import { type NetworkEntry } from '@/components/tests/NetworkPanel'
import { type ConsoleEntry } from '@/components/tests/ConsolePanel'
import { type LiveStep } from '@/components/tests/StepRows'
import { useAuthorSession } from '@/hooks/useAuthorSession'
import { useSocketSession } from '@/hooks/useSocketSession'
import { useCanvasInput } from '@/hooks/useCanvasInput'
import { useBrowserNavigation } from '@/hooks/useBrowserNavigation'
import { useRunExecution } from '@/hooks/useRunExecution'
import { useStepManagement } from '@/hooks/useStepManagement'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Label } from '@workspace/ui/components/label'
import { Separator } from '@workspace/ui/components/separator'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'
import { Switch } from '@workspace/ui/components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select'

type Tab = 'steps' | 'prerequisites'

export default function TestPage() {
  const { id: testId } = useParams<{ id: string }>()

  const { data: test, refetch } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => api.get<TestWithSteps>(`/tests/${testId}`),
  })

  const { data: workspaceVariables = [], refetch: refetchVariables } = useQuery({
    queryKey: ['workspace-variables'],
    queryFn: () => api.get<WorkspaceVariable[]>('/workspace/variables'),
  })

  // Last completed run — used to seed the recording and step screenshots
  const lastRunId = test?.runs?.find((r) => r.status === 'PASSED' || r.status === 'FAILED')?.id
  const { data: lastRunDetails } = useQuery({
    queryKey: ['run', lastRunId],
    queryFn: () => api.get<TestRun>(`/runs/${lastRunId}`),
    enabled: !!lastRunId,
  })
  const lastRunStepMap = new Map<string, TestRunStep>(
    (lastRunDetails?.stepResults ?? []).filter((s) => s.testStepId).map((s) => [s.testStepId!, s])
  )

  // User-selected run from the Runs tab
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const { data: selectedRunDetails } = useQuery({
    queryKey: ['run', selectedRunId],
    queryFn: () => api.get<TestRun>(`/runs/${selectedRunId}`),
    enabled: !!selectedRunId,
  })
  const selectedRunStepMap = selectedRunId && selectedRunDetails
    ? new Map<string, TestRunStep>(
        (selectedRunDetails.stepResults ?? []).filter((s) => s.testStepId).map((s) => [s.testStepId!, s])
      )
    : null

  // Active display sources — selected run overrides last run
  const activeStepMap = selectedRunStepMap ?? lastRunStepMap
  const activeRunId = selectedRunId ?? lastRunId ?? null

  // Browser events (network + console) for the viewed run
  const { data: runEvents } = useQuery({
    queryKey: ['run-events', activeRunId],
    queryFn: () => api.get<BrowserEventLog>(`/runs/${activeRunId}/events`),
    enabled: !!activeRunId,
  })

  const [tab, setTab] = useState<Tab>('steps')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  const allStepsForLookup = [...(test?.prerequisites ?? []).flatMap((p) => p.steps), ...(test?.steps ?? [])]
  const selectedStep = selectedStepId ? allStepsForLookup.find((s) => s.id === selectedStepId) : undefined
  const selectedRunStep = selectedStepId ? activeStepMap.get(selectedStepId) : undefined
  function toggleSection(id: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Authoring session ───────────────────────────────────────────────────────

  const {
    sessionState, setSessionState, statusLabel, setStatusLabel,
    sessionId, setSessionId, sessionIdRef, ensureSession,
  } = useAuthorSession(testId)

  const [instruction, setInstruction] = useState('')
  const [stepRunning, setStepRunning] = useState(false)
  const [liveSteps, setLiveSteps] = useState<LiveStep[]>([])
  const [replayPos, setReplayPos] = useState<number | null>(null)
  const [replayResults, setReplayResults] = useState<Record<number, boolean>>({})

  const [networkEntries, setNetworkEntries] = useState<NetworkEntry[]>([])
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const consoleEndRef = useRef<HTMLDivElement>(null)
  const sessionStartRef = useRef<number>(0)

  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([])
  const [interactiveMode, setInteractiveMode] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const urlFocusedRef = useRef(false)
  const urlBarRef = useRef<HTMLInputElement>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stepsEndRef = useRef<HTMLDivElement>(null)
  const pendingInstructionRef = useRef<string | null>(null)

  // ── Hooks ────────────────────────────────────────────────────────────────────

  const canvasHandlers = useCanvasInput(sessionIdRef, sessionState, interactiveMode, canvasRef)

  useEffect(() => {
    if (!interactiveMode) {
      canvasHandlers.isDraggingRef.current = false
      canvasRef.current?.blur()
    }
  }, [interactiveMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const nav = useBrowserNavigation(sessionId)
  const run = useRunExecution(canvasRef, refetch)
  const steps = useStepManagement(testId, test, refetch)

  // ── Author session socket ───────────────────────────────────────────────────

  useSocketSession(sessionId, {
    onFrame: (frameBase64) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const img = new Image()
      img.onload = () => ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = `data:image/jpeg;base64,${frameBase64}`
    },
    onAuthorReady: () => {
      setSessionState('ready')
      setStatusLabel('')
      setReplayPos(null)
      setReplayResults({})
    },
    onStepStarted: (pos) => setReplayPos(pos),
    onStepCompleted: (pos, passed) => setReplayResults((prev) => ({ ...prev, [pos]: passed })),
    onTabsUpdate: (tabs) => {
      setBrowserTabs(tabs)
      const active = tabs.find((t) => t.active)
      if (active && !urlFocusedRef.current) setUrlInput(active.url)
    },
    onBrowserEvent: (e) => {
      if (e.kind === 'network.response') {
        setNetworkEntries((prev) => [{
          id: e.requestId as string,
          timestamp: e.timestamp as number,
          method: e.method as string,
          url: e.url as string,
          requestHeaders: e.requestHeaders as Record<string, string>,
          requestBody: e.requestBody as string | undefined,
          status: e.status as number,
          responseHeaders: e.responseHeaders as Record<string, string>,
          mimeType: e.mimeType as string,
          pending: true,
        }, ...prev].slice(0, 500))
      } else if (e.kind === 'network.body') {
        setNetworkEntries((prev) => prev.map((n) =>
          n.id === e.requestId ? { ...n, responseBody: e.base64Encoded ? '[binary]' : e.body as string, duration: e.duration as number, pending: false } : n
        ))
      } else {
        const entry: ConsoleEntry = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: (e.timestamp as number) ?? Date.now(),
          kind: e.kind === 'console' ? (e.level as ConsoleEntry['kind'] ?? 'log') : e.kind as ConsoleEntry['kind'],
          message: e.kind === 'navigation' ? e.message as string : (e.message as string ?? ''),
        }
        setConsoleEntries((prev) => [...prev, entry].slice(-500))
      }
    },
  })

  // ── Side effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveSteps.length])

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleEntries.length])

  useEffect(() => {
    if (sessionState !== 'ready' || !pendingInstructionRef.current) return
    const instr = pendingInstructionRef.current
    pendingInstructionRef.current = null
    handleRunStep(instr)
  }, [sessionState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Author actions ───────────────────────────────────────────────────────────

  async function seek(opts: { fromFlatPos?: number; toFlatPos?: number; navigate?: boolean; label?: string }) {
    if (!sessionId) return
    setSessionState('warming')
    setStatusLabel(opts.label ?? 'Replaying…')
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
      setSessionState('ready')
      setStatusLabel('')
    }
  }

  async function handleRunStep(overrideInstruction?: string) {
    const instr = (overrideInstruction ?? instruction).trim()
    if (!sessionId || !instr || stepRunning || sessionState !== 'ready') return
    if (!overrideInstruction) setInstruction('')
    setStepRunning(true)
    setLiveSteps((prev) => [...prev, { instruction: instr, result: 'RUNNING' }])
    try {
      const res = await api.post<{ result: 'PASSED' | 'FAILED'; errorMessage?: string; durationMs: number; stepIndex: number }>(
        `/author/${sessionId}/step`, { instruction: instr },
      )
      setLiveSteps((prev) => prev.map((s, i) =>
        i === prev.length - 1 ? { ...s, result: res.result, errorMessage: res.errorMessage, durationMs: res.durationMs, stepIndex: res.stepIndex } : s,
      ))
      if (res.result === 'PASSED') {
        await refetch()
        setLiveSteps((prev) => prev.filter((s) => s.result !== 'PASSED'))
      }
    } catch (err: any) {
      setLiveSteps((prev) => prev.map((s, i) =>
        i === prev.length - 1 ? { ...s, result: 'FAILED', errorMessage: err?.response?.data?.message ?? err?.message ?? 'Request failed' } : s,
      ))
    } finally {
      setStepRunning(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    if (e.metaKey || e.ctrlKey) {
      const instr = instruction.trim()
      if (!instr || !sessionId) return
      if (existingSteps.length === 0 && prerequisites.length === 0) {
        handleRunStep()
      } else {
        pendingInstructionRef.current = instr
        setInstruction('')
        seek({ label: 'Replaying all steps…' })
      }
    } else {
      handleRunStep()
    }
  }

  const [launching, setLaunching] = useState(false)

  function handleStartBrowser() {
    ensureSession((_, initialTabs) => {
      setNetworkEntries([])
      setConsoleEntries([])
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
    setSessionState('idle')
    setStatusLabel('')
    setLiveSteps([])
    setReplayPos(null)
    setReplayResults({})
  }

  async function handleToggleContinueOnFailure(value: boolean) {
    await api.patch(`/tests/${testId}`, { continueOnFailure: value })
    refetch()
  }

  async function handleRunTest() {
    if (sessionIdRef.current) {
      api.delete(`/author/${sessionIdRef.current}`).catch(() => {})
      sessionIdRef.current = null
      setSessionId(null)
      setSessionState('idle')
    }
    setSelectedRunId(null)
    setLaunching(true)
    try {
      const { runId } = await api.post<{ runId: string }>(`/tests/${testId}/runs`)
      run.startRun(runId)
      setTab('steps')
    } finally {
      setLaunching(false)
    }
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const isReady = sessionState === 'ready'
  const isBusy = sessionState === 'starting' || sessionState === 'warming' || stepRunning
  const existingSteps = test?.steps ?? []
  const prerequisites = test?.prerequisites ?? []
  const hasContent = existingSteps.length > 0 || prerequisites.length > 0
  const prereqStepCount = prerequisites.reduce((sum, p) => sum + p.steps.length, 0)
  // Flat ordered list of all steps (prereqs first, then main) — used by RunPanel
  const allStepsFlat = [...prerequisites.flatMap((p) => p.steps), ...existingSteps]
  const passedCount = run.runSteps.filter((s) => s.result === 'PASSED').length

  function getReplayState(flatPos: number): 'running' | 'passed' | 'failed' | null {
    // Author session seek/replay
    if (sessionState === 'warming') {
      if (replayPos === flatPos) return 'running'
      if (flatPos in replayResults) return replayResults[flatPos] ? 'passed' : 'failed'
      return null
    }
    // Live run execution — runSteps accumulates in flat order (prereqs then main)
    if (run.runMode) {
      const completed = run.runSteps[flatPos]
      if (completed) return completed.result === 'PASSED' ? 'passed' : 'failed'
      if ((run.runStatus === 'QUEUED' || run.runStatus === 'RUNNING') && flatPos === run.runSteps.length) return 'running'
      return null
    }
    return null
  }

  const tabDefs: { key: Tab; label: string }[] = [
    { key: 'steps', label: `Steps (${existingSteps.length})` },
    { key: 'prerequisites', label: `Prerequisites (${prerequisites.length})` },
  ]

  const allRuns = test?.runs ?? []

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          {test && (
            <>
              <Link href={ROUTES.projectTests(test.projectId)} className="hover:text-foreground transition-colors">Tests</Link>
              <span>/</span>
            </>
          )}
          <span className="text-foreground font-medium">{test?.name ?? '…'}</span>
          {test && !test.enabled && <Badge variant="outline" className="text-xs text-muted-foreground">disabled</Badge>}
        </nav>
      </header>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card shrink-0 flex-wrap">
        {/* Left: run selector */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {allRuns.length > 0 && !run.runMode && (
            <Select
              value={selectedRunId ?? 'latest'}
              onValueChange={(v) => setSelectedRunId(v === 'latest' ? null : v)}
            >
              <SelectTrigger className="h-7 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest run</SelectItem>
                {allRuns.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span className={r.status === 'PASSED' ? 'text-green-600' : r.status === 'FAILED' ? 'text-destructive' : 'text-muted-foreground'}>
                        {r.status}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Run progress */}
          {run.runMode && (run.runStatus === 'RUNNING' || run.runStatus === 'QUEUED') && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              Running…
            </span>
          )}
          {run.runMode && run.runStatus && run.runStatus !== 'RUNNING' && run.runStatus !== 'QUEUED' && (
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{passedCount}/{run.runSteps.length} passed</span>
              <Badge variant={run.runStatus === 'PASSED' ? 'secondary' : 'destructive'} className="text-xs">{run.runStatus}</Badge>
            </span>
          )}

          {/* Author session status */}
          {!run.runMode && isBusy && statusLabel && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              {statusLabel}
            </span>
          )}
          {!run.runMode && isReady && (
            <span className="flex items-center gap-1.5 text-xs text-primary">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!run.runMode && isReady && hasContent && (
            <Button variant="ghost" size="sm" onClick={() => seek({ label: 'Replaying all steps…' })}>Start over</Button>
          )}
          {!run.runMode && sessionState !== 'idle' && (
            <Button variant="ghost" size="sm" onClick={handleCloseSession}>✕ Close browser</Button>
          )}
          {!run.runMode && (
            <div className="flex items-center gap-2">
              <Switch
                id="continue-on-failure"
                size="sm"
                checked={test?.continueOnFailure ?? false}
                onCheckedChange={handleToggleContinueOnFailure}
              />
              <Label htmlFor="continue-on-failure" className="text-xs text-muted-foreground cursor-pointer select-none">
                Continue on fail
              </Label>
            </div>
          )}
          <Button onClick={handleRunTest} disabled={run.runMode || launching || !test?.enabled || existingSteps.length === 0} size="sm">
            {launching ? 'Starting…' : '▶ Run test'}
          </Button>
        </div>
      </div>

      {/* Viewing historical run banner */}
      {selectedRunId && selectedRunId !== lastRunId && !run.runMode && (
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 border-b border-border shrink-0">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 shrink-0" />
          <span className="text-xs text-muted-foreground flex-1">
            Viewing run from {selectedRunDetails ? new Date(selectedRunDetails.createdAt).toLocaleString() : '…'}
            {selectedRunDetails && (
              <> · <span className={selectedRunDetails.status === 'PASSED' ? 'text-green-600' : 'text-destructive'}>{selectedRunDetails.status}</span> · {selectedRunDetails.passedSteps}/{selectedRunDetails.totalSteps} steps</>
            )}
          </span>
          <button
            onClick={() => setSelectedRunId(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕ Back to latest
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="flex flex-col w-[460px] shrink-0 border-r border-border">
          <div className="flex border-b border-border px-4 shrink-0">
            {tabDefs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`py-[13px] px-1 mr-4 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'steps' && (
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

          {tab === 'prerequisites' && test && (
            <div className="flex-1 overflow-y-auto p-4">
              <PrerequisiteManager test={test} onUpdate={() => refetch()} />
            </div>
          )}

        </div>

        {/* Right panel */}
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
          onActivateTab={(id) => { nav.handleActivateTab(id); setBrowserTabs((prev) => prev.map((t) => ({ ...t, active: t.targetId === id }))) }}
          onCloseTab={nav.handleCloseTab}
          urlInput={urlInput}
          urlFocusedRef={urlFocusedRef}
          urlBarRef={urlBarRef}
          onUrlChange={setUrlInput}
          onNavigate={nav.navigate}
          onBack={nav.goBack}
          onForward={nav.goForward}
          onReload={nav.reload}
          networkEntries={networkEntries}
          onClearNetwork={() => setNetworkEntries([])}
          consoleEntries={consoleEntries}
          onClearConsole={() => setConsoleEntries([])}
          consoleEndRef={consoleEndRef}
          sessionStartRef={sessionStartRef}
          selectedStep={selectedStep}
          selectedRunStep={selectedRunStep}
          onClearSelectedStep={() => setSelectedStepId(null)}
          runEvents={runEvents ?? null}
        />
      </div>
    </div>
  )
}
