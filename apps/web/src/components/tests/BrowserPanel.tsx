'use client'

import { useState, useEffect, RefObject } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cancel01Icon, Cursor01Icon,
  ArrowLeft01Icon, ArrowRight01Icon, Refresh01Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons'
import { BrowserTab, TestStep, TestRunStep, BrowserEventLog } from '@/lib/types'
import { SessionState } from '@/hooks/useAuthorSession'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
import { NetworkPanel, type NetworkEntry } from './NetworkPanel'
import { ConsolePanel, type ConsoleEntry } from './ConsolePanel'
import { ApplicationPanel } from './ApplicationPanel'
import { FramePlayer } from './FramePlayer'
import { Button } from '@workspace/ui/components/button'

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
  sessionId, runActive, lastRunId, onStartBrowser, sessionState, isBusy, statusLabel,
  canvasRef, canvasHandlers, interactiveMode, onInteractiveModeChange,
  browserTabs, onActivateTab, onCloseTab,
  urlInput, urlFocusedRef, urlBarRef, onUrlChange, onNavigate, onBack, onForward, onReload,
  networkEntries, onClearNetwork, consoleEntries, onClearConsole, consoleEndRef, sessionStartRef,
  selectedStep, selectedRunStep, onClearSelectedStep, runEvents,
}: BrowserPanelProps) {
  const [bottomTab, setBottomTab] = useState<'network' | 'console' | 'application'>('network')

  // Canvas is visible whenever a session is live OR a run is in progress
  const showCanvas = sessionState !== 'idle' || runActive

  // Step detail view — shown when a step is selected from the left panel
  if (selectedStep) {
    const passed = selectedRunStep?.result === 'PASSED'
    return (
      <div className="flex-1 bg-card flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-[9px] border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug">
              {selectedStep.description || selectedStep.instruction}
            </p>
            {selectedStep.description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{selectedStep.instruction}</p>
            )}
          </div>
          <button
            onClick={onClearSelectedStep}
            className="shrink-0 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!selectedRunStep ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-muted-foreground">This step has not been run yet</p>
              <p className="text-xs text-muted-foreground/60">Run the test to see results here</p>
            </div>
          ) : (
            <>
              {/* Result row */}
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${passed ? 'bg-green-500' : 'bg-destructive'}`} />
                <span className={`text-sm font-medium ${passed ? 'text-green-600' : 'text-destructive'}`}>
                  {passed ? 'Passed' : 'Failed'}
                </span>
                {selectedRunStep.durationMs !== undefined && (
                  <span className="text-xs text-muted-foreground ml-auto">{selectedRunStep.durationMs}ms</span>
                )}
              </div>

              {/* Error / reason */}
              {selectedRunStep.errorMessage && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-xs font-medium text-destructive mb-1">Reason</p>
                  <p className="text-xs text-destructive/90 leading-relaxed">{selectedRunStep.errorMessage}</p>
                </div>
              )}

              {/* Selectors */}
              {passed && selectedRunStep.actionsJson && selectedRunStep.actionsJson.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {selectedRunStep.actionsJson.length === 1 ? 'Selector' : 'Selectors'}
                  </p>
                  <div className="space-y-2">
                    {selectedRunStep.actionsJson.map((action, i) => (
                      <div key={i} className="rounded-lg bg-muted/40 border border-border px-3 py-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{action.method}</span>
                          {action.description && (
                            <span className="text-xs text-muted-foreground">— {action.description}</span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-muted-foreground break-all leading-relaxed">
                          {action.selector}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Screenshot */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Screenshot</p>
                {selectedRunStep.screenshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedRunStep.screenshotUrl.startsWith('http') ? selectedRunStep.screenshotUrl : `${API_BASE}${selectedRunStep.screenshotUrl}`}
                    alt="Step screenshot"
                    className="w-full rounded-xl border border-border object-contain"
                  />
                ) : (
                  <div className="w-full aspect-video rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">No screenshot captured</p>
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
    <div className="flex-1 bg-muted/20 flex flex-col overflow-hidden">

      {/* ── Author mode: tab bar ── */}
      {sessionId && !runActive && browserTabs.length > 0 && (
        <div className="flex items-center border-b border-border bg-card shrink-0 overflow-x-auto">
          {browserTabs.map((t) => (
            <div
              key={t.targetId}
              className={`group flex items-center gap-1.5 px-3 py-[13px] min-w-0 max-w-52 border-r border-border cursor-pointer shrink-0 transition-colors ${
                t.active ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
              onClick={() => onActivateTab(t.targetId)}
            >
              <TabFavicon url={t.url} />
              <span className="text-xs truncate flex-1 min-w-0">{tabTitle(t.url)}</span>
              {browserTabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCloseTab(t.targetId) }}
                  className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-foreground transition-opacity leading-none"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={10} color="currentColor" strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Author mode: URL bar ── */}
      {sessionId && !runActive && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card shrink-0">
          <button onClick={onBack} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Go back">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} color="currentColor" strokeWidth={1.5} />
          </button>
          <button onClick={onForward} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Go forward">
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} color="currentColor" strokeWidth={1.5} />
          </button>
          <button onClick={onReload} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Reload">
            <HugeiconsIcon icon={Refresh01Icon} size={14} color="currentColor" strokeWidth={1.5} />
          </button>
          <div className="flex-1 flex items-center bg-muted/50 border border-border rounded-md px-2.5 h-7 ml-1 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all">
            <input
              ref={urlBarRef}
              type="text"
              value={urlInput}
              onChange={(e) => onUrlChange(e.target.value)}
              onFocus={(e) => { urlFocusedRef.current = true; e.target.select() }}
              onBlur={() => {
                urlFocusedRef.current = false
                const active = browserTabs.find((t) => t.active)
                if (active) onUrlChange(active.url)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onNavigate(urlInput); urlFocusedRef.current = false }
                if (e.key === 'Escape') {
                  urlFocusedRef.current = false
                  urlBarRef.current?.blur()
                  const active = browserTabs.find((t) => t.active)
                  if (active) onUrlChange(active.url)
                }
              }}
              placeholder="Enter URL…"
              className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* ── Canvas area (always mounted; collapses to h-0 when idle so it keeps receiving frames) ── */}
      <div className={showCanvas ? 'flex-1 flex items-center justify-center p-6 overflow-hidden min-h-0' : 'h-0 overflow-hidden'}>
        <div className="w-full max-w-4xl space-y-3">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              tabIndex={0}
              className={`w-full aspect-video rounded-xl border bg-black outline-none transition-colors ${
                sessionState === 'ready' && !runActive && interactiveMode
                  ? 'border-primary cursor-crosshair'
                  : 'border-border cursor-default'
              }`}
              onMouseDown={canvasHandlers.onMouseDown}
              onMouseUp={canvasHandlers.onMouseUp}
              onMouseMove={canvasHandlers.onMouseMove}
              onMouseLeave={canvasHandlers.onMouseLeave}
              onContextMenu={canvasHandlers.onContextMenu}
              onKeyDown={canvasHandlers.onKeyDown}
              onKeyUp={canvasHandlers.onKeyUp}
            />
            {sessionState === 'ready' && !runActive && !interactiveMode && (
              <div className="absolute bottom-3 right-3 cursor-pointer" onClick={() => { onInteractiveModeChange(true); canvasRef.current?.focus() }}>
                <div className="flex items-center gap-1.5 bg-card/90 backdrop-blur-sm border border-border rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors select-none">
                  <HugeiconsIcon icon={Cursor01Icon} size={12} color="currentColor" strokeWidth={1.5} />
                  Enable interaction
                </div>
              </div>
            )}
            {sessionState === 'ready' && !runActive && interactiveMode && (
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => onInteractiveModeChange(false)}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs px-2.5 py-1 rounded-md hover:bg-primary/90 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                  Interacting · click to stop
                </button>
              </div>
            )}
          </div>
          {isBusy && statusLabel && !runActive && (
            <p className="text-xs text-center text-muted-foreground">{statusLabel}</p>
          )}
        </div>
      </div>

      {/* ── Idle: recording + logs in a scrollable column ── */}
      {!showCanvas && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-4xl mx-auto space-y-4">
            {lastRunId ? (
              <>
                <FramePlayer runId={lastRunId} />

                {/* Logs below recording */}
                {runEvents && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center border-b border-border bg-muted/30">
                      {(['network', 'console'] as const).map((t) => {
                        const errorCount = runEvents.console.filter((e) => e.kind === 'error').length
                        return (
                          <button
                            key={t}
                            onClick={() => setBottomTab(t)}
                            className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-colors capitalize flex items-center gap-1.5 ${bottomTab === t ? 'border-primary text-foreground bg-card' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                          >
                            {t === 'network' && <>{runEvents.network.length > 0 && <span className="text-muted-foreground">{runEvents.network.length}</span>} Network</>}
                            {t === 'console' && (
                              <>Console{errorCount > 0 && (
                                <span className="px-1 rounded bg-destructive/15 text-destructive text-[10px]">{errorCount}</span>
                              )}</>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <div className="h-64">
                      {bottomTab !== 'application' && bottomTab === 'network' && (
                        <NetworkPanel entries={runEvents.network.map((e) => ({ ...e, mimeType: e.mimeType ?? '', pending: false }))} />
                      )}
                      {(bottomTab === 'console' || bottomTab === 'application') && (
                        <ConsolePanel entries={runEvents.console} endRef={consoleEndRef} startedAt={0} />
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                className="w-full aspect-video rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={onStartBrowser}
              >
                <HugeiconsIcon icon={PlayIcon} size={28} color="currentColor" strokeWidth={1} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to open a live browser</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom dev tools: live session only ── */}
      {sessionId && !runActive && (() => {
        const errorCount = consoleEntries.filter((e) => e.kind === 'error' || e.kind === 'exception').length
        return (
          <div className="shrink-0 border-t border-border bg-card flex flex-col h-72">
            <div className="flex items-center border-b border-border shrink-0 bg-muted/30">
              {(['network', 'console', 'application'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBottomTab(t)}
                  className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-colors capitalize flex items-center gap-1.5 ${bottomTab === t ? 'border-primary text-foreground bg-card' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {t === 'network' && <>{networkEntries.length > 0 && <span className="text-muted-foreground">{networkEntries.length}</span>} Network</>}
                  {t === 'console' && (
                    <>Console{errorCount > 0 && (
                      <span className="px-1 rounded bg-destructive/15 text-destructive text-[10px]">{errorCount}</span>
                    )}</>
                  )}
                  {t === 'application' && 'Application'}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 pr-3">
                {bottomTab === 'network' && networkEntries.length > 0 && (
                  <button onClick={onClearNetwork} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                )}
                {bottomTab === 'console' && consoleEntries.length > 0 && (
                  <button onClick={onClearConsole} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                )}
              </div>
            </div>
            {bottomTab === 'network' && <NetworkPanel entries={networkEntries} />}
            {bottomTab === 'console' && <ConsolePanel entries={consoleEntries} endRef={consoleEndRef} startedAt={sessionStartRef.current} />}
            {bottomTab === 'application' && <ApplicationPanel sessionId={sessionId} />}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Local UI helpers ─────────────────────────────────────��───────────────────

function tabTitle(url: string): string {
  try { const u = new URL(url); return u.hostname || 'New Tab' } catch { return 'New Tab' }
}

function TabFavicon({ url }: { url: string }) {
  const [visible, setVisible] = useState(true)
  let origin: string | null = null
  try {
    const u = new URL(url)
    if (u.protocol !== 'about:' && u.protocol !== 'data:') origin = u.origin
  } catch { /* ignore */ }
  if (!origin || !visible) return <span className="w-3 h-3 shrink-0 rounded-sm bg-muted-foreground/20" />
  return <img src={`${origin}/favicon.ico`} className="w-3 h-3 shrink-0 rounded-sm" onError={() => setVisible(false)} alt="" />
}
