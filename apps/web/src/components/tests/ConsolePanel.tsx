"use client"

export interface ConsoleEntry {
  id: string
  timestamp: number
  kind: "log" | "info" | "warn" | "error" | "exception" | "navigation"
  message: string
}

const kindColor: Record<ConsoleEntry["kind"], string> = {
  error: "text-destructive",
  exception: "text-destructive",
  warn: "text-muted-foreground",
  log: "text-foreground/80",
  info: "text-muted-foreground",
  navigation: "text-primary",
}

const kindLabel: Record<ConsoleEntry["kind"], string> = {
  error: "ERR",
  exception: "EXC",
  warn: "WRN",
  log: "LOG",
  info: "INF",
  navigation: "NAV",
}

export function ConsolePanel({
  entries,
  endRef,
  startedAt,
}: {
  entries: ConsoleEntry[]
  endRef: React.RefObject<HTMLDivElement | null>
  startedAt: number
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        No console output yet.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto font-mono text-[11px]">
      {entries.map((e) => {
        const elapsed = ((e.timestamp - startedAt) / 1000).toFixed(1)
        return (
          <div
            key={e.id}
            className={`flex items-start gap-3 border-b border-border/30 px-3 py-1 hover:bg-muted/30 ${kindColor[e.kind]}`}
          >
            <span className="shrink-0 text-muted-foreground/50">
              {elapsed}s
            </span>
            <span className="w-7 shrink-0 font-bold">{kindLabel[e.kind]}</span>
            <span className="flex-1 break-all whitespace-pre-wrap">
              {e.message}
            </span>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
