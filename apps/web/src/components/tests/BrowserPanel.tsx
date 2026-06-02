"use client"

import { useState, useEffect, RefObject } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Cursor01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Refresh01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { BrowserTab, TestStep, TestRunStep, BrowserEventLog } from "@/lib/types"
import { SessionState } from "@/hooks/useAuthorSession"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
import { NetworkPanel, type NetworkEntry } from "./NetworkPanel"
import { ConsolePanel, type ConsoleEntry } from "./ConsolePanel"
import { ApplicationPanel } from "./ApplicationPanel"
import { FramePlayer } from "./FramePlayer"
import { Button } from "@iris/ui/components/button"

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
  canvasHandlers: {
    onMouseDown: React.MouseEventHandler<HTMLCanvasElement>
    onMouseUp: React.MouseEventHandler<HTMLCanvasElement>
    onMouseMove: React.MouseEventHandler<HTMLCanvasElement>
    onMouseLeave: () => void
    onContextMenu: React.MouseEventHandler<HTMLCanvasElement>
    onKeyDown: React.KeyboardEventHandler<HTMLCanvasElement>
    onKeyUp: React.KeyboardEventHandler<HTMLCanvasElement>
  }
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
}

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
}: BrowserPanelProps) {
  const [bottomTab, setBottomTab] = useState<
    "network" | "console" | "application"
  >("network")

  // Canvas is visible whenever a session is live OR a run is in progress
  const showCanvas = sessionState !== "idle" || runActive

  // Step detail view — shown when a step is selected from the left panel
  if (selectedStep) {
    const passed = selectedRunStep?.result === "PASSED"
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-card">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-[9px]">
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug font-medium text-foreground">
              {selectedStep.description || selectedStep.instruction}
            </p>
            {selectedStep.description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {selectedStep.instruction}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelectedStep}
            className="h-8 w-8 shrink-0 text-muted-foreground"
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              size={14}
              color="currentColor"
              strokeWidth={1.5}
            />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!selectedRunStep ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <p className="text-sm text-muted-foreground">
                This step has not been run yet
              </p>
              <p className="text-xs text-muted-foreground/60">
                Run the test to see results here
              </p>
            </div>
          ) : (
            <>
              {/* Result row */}
              <div className="flex items-center gap-3">
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${passed ? "bg-primary" : "bg-destructive"}`}
                />
                <span
                  className={`text-sm font-medium ${passed ? "text-primary" : "text-destructive"}`}
                >
                  {passed ? "Passed" : "Failed"}
                </span>
                {selectedRunStep.durationMs !== undefined && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {selectedRunStep.durationMs}ms
                  </span>
                )}
              </div>

              {/* Error / reason */}
              {selectedRunStep.errorMessage && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-destructive">
                    Reason
                  </p>
                  <p className="text-xs leading-relaxed text-destructive/90">
                    {selectedRunStep.errorMessage}
                  </p>
                </div>
              )}

              {/* Selectors */}
              {passed &&
                selectedRunStep.actionsJson &&
                selectedRunStep.actionsJson.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {selectedRunStep.actionsJson.length === 1
                        ? "Selector"
                        : "Selectors"}
                    </p>
                    <div className="space-y-2">
                      {selectedRunStep.actionsJson.map((action, i) => (
                        <div
                          key={i}
                          className="space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {action.method}
                            </span>
                            {action.description && (
                              <span className="text-xs text-muted-foreground">
                                — {action.description}
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-xs leading-relaxed break-all text-muted-foreground">
                            {action.selector}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Screenshot */}
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Screenshot
                </p>
                {selectedRunStep.screenshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      selectedRunStep.screenshotUrl.startsWith("http")
                        ? selectedRunStep.screenshotUrl
                        : `${API_BASE}${selectedRunStep.screenshotUrl}`
                    }
                    alt="Step screenshot"
                    className="w-full rounded-xl border border-border object-contain"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
                    <p className="text-xs text-muted-foreground">
                      No screenshot captured
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/20">
      {/* ── Author mode: tab bar ── */}
      {sessionId && !runActive && browserTabs.length > 0 && (
        <div className="flex shrink-0 items-center overflow-x-auto border-b border-border bg-card">
          {browserTabs.map((t) => (
            <div
              key={t.targetId}
              className={`group flex max-w-52 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 py-[13px] transition-colors ${
                t.active
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
              onClick={() => onActivateTab(t.targetId)}
            >
              <TabFavicon url={t.url} />
              <span className="min-w-0 flex-1 truncate text-xs">
                {tabTitle(t.url)}
              </span>
              {browserTabs.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseTab(t.targetId)
                  }}
                  className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-60 hover:!opacity-100"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={10}
                    color="currentColor"
                    strokeWidth={1.5}
                  />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Author mode: URL bar ── */}
      {sessionId && !runActive && (
        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            title="Go back"
            className="h-7 w-7 text-muted-foreground"
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={14}
              color="currentColor"
              strokeWidth={1.5}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onForward}
            title="Go forward"
            className="h-7 w-7 text-muted-foreground"
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={14}
              color="currentColor"
              strokeWidth={1.5}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onReload}
            title="Reload"
            className="h-7 w-7 text-muted-foreground"
          >
            <HugeiconsIcon
              icon={Refresh01Icon}
              size={14}
              color="currentColor"
              strokeWidth={1.5}
            />
          </Button>
          <div className="ml-1 flex h-7 flex-1 items-center rounded-md border border-border bg-muted/50 px-2.5 transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            <input
              ref={urlBarRef}
              type="text"
              value={urlInput}
              onChange={(e) => onUrlChange(e.target.value)}
              onFocus={(e) => {
                urlFocusedRef.current = true
                e.target.select()
              }}
              onBlur={() => {
                urlFocusedRef.current = false
                const active = browserTabs.find((t) => t.active)
                if (active) onUrlChange(active.url)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onNavigate(urlInput)
                  urlFocusedRef.current = false
                }
                if (e.key === "Escape") {
                  urlFocusedRef.current = false
                  urlBarRef.current?.blur()
                  const active = browserTabs.find((t) => t.active)
                  if (active) onUrlChange(active.url)
                }
              }}
              placeholder="Enter URL…"
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* ── Canvas area (always mounted; collapses to h-0 when idle so it keeps receiving frames) ── */}
      <div
        className={
          showCanvas
            ? "flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6"
            : "h-0 overflow-hidden"
        }
      >
        <div className="w-full max-w-4xl space-y-3">
          <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-black shadow-xl">
            {/* Mock Browser Chrome */}
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/80 px-4">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-primary/80" />
              <div className="mr-8 flex flex-1 justify-center">
                <div className="flex h-5 w-64 items-center justify-center rounded-md bg-background/50 font-mono text-[10px] text-muted-foreground/50 select-none">
                  live session
                </div>
              </div>
            </div>

            <div className="relative">
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                tabIndex={0}
                className={`aspect-video w-full bg-black transition-colors outline-none ${
                  sessionState === "ready" && !runActive && interactiveMode
                    ? "cursor-crosshair"
                    : "cursor-default"
                }`}
                onMouseDown={canvasHandlers.onMouseDown}
                onMouseUp={canvasHandlers.onMouseUp}
                onMouseMove={canvasHandlers.onMouseMove}
                onMouseLeave={canvasHandlers.onMouseLeave}
                onContextMenu={canvasHandlers.onContextMenu}
                onKeyDown={canvasHandlers.onKeyDown}
                onKeyUp={canvasHandlers.onKeyUp}
              />
              {sessionState === "ready" && !runActive && !interactiveMode && (
                <div
                  className="absolute right-3 bottom-3 cursor-pointer"
                  onClick={() => {
                    onInteractiveModeChange(true)
                    canvasRef.current?.focus()
                  }}
                >
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-colors select-none hover:border-primary hover:text-foreground">
                    <HugeiconsIcon
                      icon={Cursor01Icon}
                      size={12}
                      color="currentColor"
                      strokeWidth={1.5}
                    />
                    Enable interaction
                  </div>
                </div>
              )}
              {sessionState === "ready" && !runActive && interactiveMode && (
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => onInteractiveModeChange(false)}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
                    Interacting · click to stop
                  </button>
                </div>
              )}
            </div>
          </div>
          {isBusy && statusLabel && !runActive && (
            <p className="text-center text-xs text-muted-foreground">
              {statusLabel}
            </p>
          )}
        </div>
      </div>

      {/* ── Idle: recording + logs in a scrollable column ── */}
      {!showCanvas && (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-4 p-6">
            {lastRunId ? (
              <>
                <FramePlayer runId={lastRunId} />

                {/* Logs below recording */}
                {runEvents && (
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-1 border-b border-border bg-muted/10 p-1.5">
                      {(["network", "console"] as const).map((t) => {
                        const errorCount = runEvents.console.filter(
                          (e) => e.kind === "error"
                        ).length
                        return (
                          <Button
                            key={t}
                            variant="ghost"
                            size="sm"
                            onClick={() => setBottomTab(t)}
                            className={`flex h-auto items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize ${bottomTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                          >
                            {t === "network" && (
                              <>
                                {runEvents.network.length > 0 && (
                                  <span className="text-muted-foreground">
                                    {runEvents.network.length}
                                  </span>
                                )}{" "}
                                Network
                              </>
                            )}
                            {t === "console" && (
                              <>
                                Console
                                {errorCount > 0 && (
                                  <span className="rounded bg-destructive/15 px-1 text-[10px] text-destructive">
                                    {errorCount}
                                  </span>
                                )}
                              </>
                            )}
                          </Button>
                        )
                      })}
                    </div>
                    <div className="h-64">
                      {bottomTab !== "application" &&
                        bottomTab === "network" && (
                          <NetworkPanel
                            entries={runEvents.network.map((e) => ({
                              ...e,
                              mimeType: e.mimeType ?? "",
                              pending: false,
                            }))}
                          />
                        )}
                      {(bottomTab === "console" ||
                        bottomTab === "application") && (
                        <ConsolePanel
                          entries={runEvents.console}
                          endRef={consoleEndRef}
                          startedAt={0}
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 transition-colors hover:border-primary/50 hover:bg-muted/30"
                onClick={onStartBrowser}
              >
                <HugeiconsIcon
                  icon={PlayIcon}
                  size={28}
                  color="currentColor"
                  strokeWidth={1}
                  className="text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  Click to open a live browser
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom dev tools: live session only ── */}
      {sessionId &&
        !runActive &&
        (() => {
          const errorCount = consoleEntries.filter(
            (e) => e.kind === "error" || e.kind === "exception"
          ).length
          return (
            <div className="flex h-72 shrink-0 flex-col border-t border-border bg-card">
              <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/10 p-1.5">
                {(["network", "console", "application"] as const).map((t) => (
                  <Button
                    key={t}
                    variant="ghost"
                    size="sm"
                    onClick={() => setBottomTab(t)}
                    className={`flex h-auto items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize ${bottomTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                    {t === "network" && (
                      <>
                        {networkEntries.length > 0 && (
                          <span className="text-muted-foreground">
                            {networkEntries.length}
                          </span>
                        )}{" "}
                        Network
                      </>
                    )}
                    {t === "console" && (
                      <>
                        Console
                        {errorCount > 0 && (
                          <span className="rounded bg-destructive/15 px-1 text-[10px] text-destructive">
                            {errorCount}
                          </span>
                        )}
                      </>
                    )}
                    {t === "application" && "Application"}
                  </Button>
                ))}
                <div className="ml-auto flex items-center gap-2 pr-3">
                  {bottomTab === "network" && networkEntries.length > 0 && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={onClearNetwork}
                      className="h-auto text-[11px] text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                  {bottomTab === "console" && consoleEntries.length > 0 && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={onClearConsole}
                      className="h-auto text-[11px] text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              {bottomTab === "network" && (
                <NetworkPanel entries={networkEntries} />
              )}
              {bottomTab === "console" && (
                <ConsolePanel
                  entries={consoleEntries}
                  endRef={consoleEndRef}
                  startedAt={sessionStartRef.current}
                />
              )}
              {bottomTab === "application" && (
                <ApplicationPanel sessionId={sessionId} />
              )}
            </div>
          )
        })()}
    </div>
  )
}

// ─── Local UI helpers ─────────────────────────────────────��───────────────────

function tabTitle(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname || "New Tab"
  } catch {
    return "New Tab"
  }
}

function TabFavicon({ url }: { url: string }) {
  const [visible, setVisible] = useState(true)
  let origin: string | null = null
  try {
    const u = new URL(url)
    if (u.protocol !== "about:" && u.protocol !== "data:") origin = u.origin
  } catch {
    /* ignore */
  }
  if (!origin || !visible)
    return (
      <span className="h-3 w-3 shrink-0 rounded-sm bg-muted-foreground/20" />
    )
  return (
    <img
      src={`${origin}/favicon.ico`}
      className="h-3 w-3 shrink-0 rounded-sm"
      onError={() => setVisible(false)}
      alt=""
    />
  )
}
