'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'

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

function methodColor(method: string) {
  const m = method.toUpperCase()
  if (m === 'GET')    return 'text-blue-500 dark:text-blue-400'
  if (m === 'POST')   return 'text-emerald-500 dark:text-emerald-400'
  if (m === 'PUT' || m === 'PATCH') return 'text-yellow-500 dark:text-yellow-400'
  if (m === 'DELETE') return 'text-destructive'
  return 'text-muted-foreground'
}

function statusColor(status?: number) {
  if (!status) return 'text-muted-foreground'
  if (status < 300) return 'text-emerald-500 dark:text-emerald-400'
  if (status < 400) return 'text-yellow-500 dark:text-yellow-400'
  return 'text-destructive'
}

function prettyBody(body?: string): string {
  if (!body) return ''
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
}

function urlPath(url: string): string {
  try { const u = new URL(url); return u.pathname + u.search } catch { return url }
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return <HugeiconsIcon icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon} size={12} color="currentColor" strokeWidth={1.5} />
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  if (entries.length === 0) return <span className="text-muted-foreground italic">none</span>
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-0.5">
      {entries.map(([k, v]) => (
        <><span key={k} className="text-muted-foreground truncate">{k}</span><span key={k + 'v'} className="truncate">{v}</span></>
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
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
      >
        <span className={`shrink-0 w-14 text-[11px] font-bold ${methodColor(entry.method)}`}>{entry.method}</span>
        <span className="flex-1 truncate font-mono text-[11px]">{urlPath(entry.url)}</span>
        {entry.pending
          ? <span className="shrink-0 text-[11px] text-muted-foreground animate-pulse">…</span>
          : <span className={`shrink-0 text-[11px] font-medium ${statusColor(entry.status)}`}>{entry.status}</span>
        }
        {entry.duration !== undefined && (
          <span className="shrink-0 text-[11px] text-muted-foreground w-14 text-right">{entry.duration}ms</span>
        )}
        <ChevronIcon collapsed={!expanded} />
      </button>

      {expanded && (
        <div className="font-mono text-[11px] px-3 pb-3 space-y-3 bg-muted/20">
          <div>
            <p className="text-muted-foreground font-sans font-medium mb-1 pt-2">Request Headers</p>
            <HeadersTable headers={entry.requestHeaders ?? {}} />
          </div>
          {entry.requestBody && (
            <div>
              <p className="text-muted-foreground font-sans font-medium mb-1">Request Body</p>
              <pre className="bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-32">{prettyBody(entry.requestBody)}</pre>
            </div>
          )}
          <div>
            <p className="text-muted-foreground font-sans font-medium mb-1">Response Headers</p>
            <HeadersTable headers={entry.responseHeaders ?? {}} />
          </div>
          {entry.responseBody !== undefined && (
            <div>
              <p className="text-muted-foreground font-sans font-medium mb-1">Response Body</p>
              <pre className="bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40">{prettyBody(entry.responseBody)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function NetworkPanel({ entries }: { entries: NetworkEntry[] }) {
  if (entries.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">No network requests yet.</div>
  }
  return (
    <div className="flex-1 overflow-y-auto">
      {entries.map((e) => <NetworkEntryRow key={e.id} entry={e} />)}
    </div>
  )
}
