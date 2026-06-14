"use client"

import { RefObject } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayIcon } from "@hugeicons/core-free-icons"
import { BrowserEventLog } from "@/lib/types"
import { Button } from "@iris/ui/components/button"
import { NetworkPanel } from "./NetworkPanel"
import { ConsolePanel } from "./ConsolePanel"
import { FramePlayer } from "./FramePlayer"
import type { DevToolsTab } from "./DevToolsPanel"

/**
 * Idle state of the browser panel: the last run's frame recording with its
 * network/console logs, or a call-to-action to open a live browser.
 */
export function IdleRunLogs({
  lastRunId,
  runEvents,
  onStartBrowser,
  tab,
  onTabChange,
  consoleEndRef,
  viewportWidth,
  viewportHeight,
}: {
  lastRunId: string | null
  runEvents?: BrowserEventLog | null
  onStartBrowser: () => void
  tab: DevToolsTab
  onTabChange: (t: DevToolsTab) => void
  consoleEndRef: RefObject<HTMLDivElement | null>
  viewportWidth?: number
  viewportHeight?: number
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        {lastRunId ? (
          <>
            <FramePlayer
              runId={lastRunId}
              viewportWidth={viewportWidth}
              viewportHeight={viewportHeight}
            />

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
                        onClick={() => onTabChange(t)}
                        className={`flex h-auto items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
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
                <div className="flex h-64 flex-col">
                  {tab !== "application" && tab === "network" && (
                    <NetworkPanel
                      entries={runEvents.network.map((e) => ({
                        ...e,
                        mimeType: e.mimeType ?? "",
                        pending: false,
                      }))}
                    />
                  )}
                  {(tab === "console" || tab === "application") && (
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
  )
}
