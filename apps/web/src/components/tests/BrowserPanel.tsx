"use client"

import { useState, RefObject } from "react"
import { BrowserTab, TestStep, TestRunStep, BrowserEventLog } from "@/lib/types"
import { SessionState } from "@/hooks/useAuthorSession"
import { type NetworkEntry } from "./NetworkPanel"
import { type ConsoleEntry } from "./ConsolePanel"
import { StepDetailsView } from "./StepDetailsView"
import { BrowserTabBar } from "./BrowserTabBar"
import { BrowserUrlBar } from "./BrowserUrlBar"
import { FrameCanvas, type CanvasHandlers } from "./FrameCanvas"
import { DevToolsPanel, type DevToolsTab } from "./DevToolsPanel"
import { IdleRunLogs } from "./IdleRunLogs"

interface BrowserPanelProps {
  sessionId: string | null
  runActive: boolean
  lastRunId: string | null
  onStartBrowser: () => void
  sessionState: SessionState
  isBusy: boolean
  statusLabel: string
  // Canvas
  canvasRef: RefObject<HTMLCanvasElement | null>
  canvasHandlers: CanvasHandlers
  interactiveMode: boolean
  onInteractiveModeChange: (v: boolean) => void
  // Browser tabs
  browserTabs: BrowserTab[]
  onActivateTab: (id: string) => void
  onCloseTab: (id: string) => void
  // URL bar
  urlInput: string
  urlFocusedRef: RefObject<boolean>
  urlBarRef: RefObject<HTMLInputElement | null>
  onUrlChange: (v: string) => void
  onNavigate: (url: string) => void
  onBack: () => void
  onForward: () => void
  onReload: () => void
  // Dev tools
  networkEntries: NetworkEntry[]
  onClearNetwork: () => void
  consoleEntries: ConsoleEntry[]
  onClearConsole: () => void
  consoleEndRef: RefObject<HTMLDivElement | null>
  sessionStartRef: RefObject<number>
  selectedStep?: TestStep
  selectedRunStep?: TestRunStep
  onClearSelectedStep?: () => void
  runEvents?: BrowserEventLog | null
  viewportWidth?: number
  viewportHeight?: number
}

/**
 * Right-hand browser pane of the test editor. Composes the live viewport
 * (tab bar, URL bar, frame canvas, devtools), the idle run-recording view,
 * and the step-details view when a step is selected.
 */
export function BrowserPanel({
  sessionId,
  runActive,
  lastRunId,
  onStartBrowser,
  sessionState,
  isBusy,
  statusLabel,
  canvasRef,
  canvasHandlers,
  interactiveMode,
  onInteractiveModeChange,
  browserTabs,
  onActivateTab,
  onCloseTab,
  urlInput,
  urlFocusedRef,
  urlBarRef,
  onUrlChange,
  onNavigate,
  onBack,
  onForward,
  onReload,
  networkEntries,
  onClearNetwork,
  consoleEntries,
  onClearConsole,
  consoleEndRef,
  sessionStartRef,
  selectedStep,
  selectedRunStep,
  onClearSelectedStep,
  runEvents,
  viewportWidth,
  viewportHeight,
}: BrowserPanelProps) {
  const [bottomTab, setBottomTab] = useState<DevToolsTab>("network")

  // Step detail view — shown when a step is selected from the left panel
  if (selectedStep) {
    return (
      <StepDetailsView
        selectedStep={selectedStep}
        selectedRunStep={selectedRunStep}
        onClear={onClearSelectedStep}
      />
    )
  }

  // Canvas is visible whenever a session is live OR a run is in progress
  const showCanvas = sessionState !== "idle" || runActive

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/20">
      {sessionId && !runActive && browserTabs.length > 0 && (
        <BrowserTabBar
          tabs={browserTabs}
          onActivateTab={onActivateTab}
          onCloseTab={onCloseTab}
        />
      )}

      {sessionId && !runActive && (
        <BrowserUrlBar
          urlInput={urlInput}
          urlFocusedRef={urlFocusedRef}
          urlBarRef={urlBarRef}
          browserTabs={browserTabs}
          onUrlChange={onUrlChange}
          onNavigate={onNavigate}
          onBack={onBack}
          onForward={onForward}
          onReload={onReload}
        />
      )}

      <FrameCanvas
        show={showCanvas}
        canvasRef={canvasRef}
        canvasHandlers={canvasHandlers}
        sessionState={sessionState}
        runActive={runActive}
        interactiveMode={interactiveMode}
        onInteractiveModeChange={onInteractiveModeChange}
        isBusy={isBusy}
        statusLabel={statusLabel}
        viewportWidth={viewportWidth}
        viewportHeight={viewportHeight}
      />

      {!showCanvas && (
        <IdleRunLogs
          lastRunId={lastRunId}
          runEvents={runEvents}
          onStartBrowser={onStartBrowser}
          tab={bottomTab}
          onTabChange={setBottomTab}
          consoleEndRef={consoleEndRef}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
        />
      )}

      {sessionId && !runActive && (
        <DevToolsPanel
          sessionId={sessionId}
          tab={bottomTab}
          onTabChange={setBottomTab}
          networkEntries={networkEntries}
          onClearNetwork={onClearNetwork}
          consoleEntries={consoleEntries}
          onClearConsole={onClearConsole}
          consoleEndRef={consoleEndRef}
          sessionStartRef={sessionStartRef}
        />
      )}
    </div>
  )
}
