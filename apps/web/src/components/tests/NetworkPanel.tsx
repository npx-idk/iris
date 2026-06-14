"use client"

import { Fragment, useState } from "react"
import { ChevronIcon } from "@/components/shared/ChevronIcon"

export interface NetworkEntry {
  id: string
  timestamp: number
  method: string
  url: string
  requestHeaders?: Record<string, string>
  requestBody?: string
  status?: number
  responseHeaders?: Record<string, string>
  responseBody?: string
  mimeType?: string
  duration?: number
  pending: boolean
}

export function methodColor(method: string) {
  const m = method.toUpperCase()
  if (m === "GET") return "text-primary"
  if (m === "POST") return "text-primary"
  if (m === "PUT" || m === "PATCH") return "text-muted-foreground"
  if (m === "DELETE") return "text-destructive"
  return "text-muted-foreground"
}

export function statusColor(status?: number) {
  if (!status) return "text-muted-foreground"
  if (status < 300) return "text-primary"
  if (status < 400) return "text-muted-foreground"
  return "text-destructive"
}

function prettyBody(body?: string): string {
  if (!body) return ""
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export function urlPath(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  if (entries.length === 0)
    return <span className="text-muted-foreground italic">none</span>
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-0.5">
      {entries.map(([k, v]) => (
        <Fragment key={k}>
          <span className="truncate text-muted-foreground">{k}</span>
          <span className="truncate">{v}</span>
        </Fragment>
      ))}
    </div>
  )
}

function NetworkEntryRow({ entry }: { entry: NetworkEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-border/40 even:bg-muted/20">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <span
          className={`w-14 shrink-0 text-[11px] font-bold ${methodColor(entry.method)}`}
        >
          {entry.method}
        </span>
        <span className="flex-1 truncate font-mono text-[11px]">
          {urlPath(entry.url)}
        </span>
        {entry.pending ? (
          <span className="shrink-0 animate-pulse text-[11px] text-muted-foreground">
            …
          </span>
        ) : (
          <span
            className={`shrink-0 text-[11px] font-medium ${statusColor(entry.status)}`}
          >
            {entry.status}
          </span>
        )}
        {entry.duration !== undefined && (
          <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">
            {entry.duration}ms
          </span>
        )}
        <ChevronIcon collapsed={!expanded} />
      </button>

      {expanded && (
        <div className="space-y-3 bg-muted/20 px-3 pb-3 font-mono text-[11px]">
          <div>
            <p className="mb-1 pt-2 font-sans font-medium text-muted-foreground">
              Request Headers
            </p>
            <HeadersTable headers={entry.requestHeaders ?? {}} />
          </div>
          {entry.requestBody && (
            <div>
              <p className="mb-1 font-sans font-medium text-muted-foreground">
                Request Body
              </p>
              <pre className="max-h-32 overflow-x-auto rounded bg-muted/50 p-2 break-all whitespace-pre-wrap">
                {prettyBody(entry.requestBody)}
              </pre>
            </div>
          )}
          <div>
            <p className="mb-1 font-sans font-medium text-muted-foreground">
              Response Headers
            </p>
            <HeadersTable headers={entry.responseHeaders ?? {}} />
          </div>
          {entry.responseBody !== undefined && (
            <div>
              <p className="mb-1 font-sans font-medium text-muted-foreground">
                Response Body
              </p>
              <pre className="max-h-40 overflow-x-auto rounded bg-muted/50 p-2 break-all whitespace-pre-wrap">
                {prettyBody(entry.responseBody)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function NetworkPanel({ entries }: { entries: NetworkEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        No network requests yet.
      </div>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto">
      {entries.map((e) => (
        <NetworkEntryRow key={e.id} entry={e} />
      ))}
    </div>
  )
}
