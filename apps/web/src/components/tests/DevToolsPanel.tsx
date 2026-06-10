"use client"

import { RefObject } from "react"
import { Button } from "@iris/ui/components/button"
import { NetworkPanel, type NetworkEntry } from "./NetworkPanel"
import { ConsolePanel, type ConsoleEntry } from "./ConsolePanel"
import { ApplicationPanel } from "./ApplicationPanel"

export type DevToolsTab = "network" | "console" | "application"

/** Bottom devtools (network/console/application) for the live authoring session. */
export function DevToolsPanel({
  sessionId,
  tab,
  onTabChange,
  networkEntries,
  onClearNetwork,
  consoleEntries,
  onClearConsole,
  consoleEndRef,
  sessionStartRef,
}: {
  sessionId: string
  tab: DevToolsTab
  onTabChange: (t: DevToolsTab) => void
  networkEntries: NetworkEntry[]
  onClearNetwork: () => void
  consoleEntries: ConsoleEntry[]
  onClearConsole: () => void
  consoleEndRef: RefObject<HTMLDivElement | null>
  sessionStartRef: RefObject<number>
}) {
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
            onClick={() => onTabChange(t)}
            className={`flex h-auto items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
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
          {tab === "network" && networkEntries.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onClearNetwork}
              className="h-auto text-[11px] text-muted-foreground"
            >
              Clear
            </Button>
          )}
          {tab === "console" && consoleEntries.length > 0 && (
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
      {tab === "network" && <NetworkPanel entries={networkEntries} />}
      {tab === "console" && (
        <ConsolePanel
          entries={consoleEntries}
          endRef={consoleEndRef}
          startedAt={sessionStartRef.current}
        />
      )}
      {tab === "application" && <ApplicationPanel sessionId={sessionId} />}
    </div>
  )
}
