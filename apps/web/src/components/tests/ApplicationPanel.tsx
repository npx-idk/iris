'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

interface StorageData {
  cookies: Array<{ name: string; value: string; domain: string; path: string; secure: boolean; httpOnly: boolean; expires: number }>
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
}

export function ApplicationPanel({ sessionId }: { sessionId: string }) {
  const [subTab, setSubTab] = useState<'cookies' | 'localStorage' | 'sessionStorage'>('cookies')
  const [data, setData] = useState<StorageData | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const d = await api.get<StorageData>(`/author/${sessionId}/application-data`)
      setData(d)
    } catch { /* session expired */ }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex flex-col overflow-hidden text-xs">
      <div className="flex items-center border-b border-border/50 shrink-0 px-1">
        {(['cookies', 'localStorage', 'sessionStorage'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${subTab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'cookies' ? 'Cookies' : t === 'localStorage' ? 'Local Storage' : 'Session Storage'}
          </button>
        ))}
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto mr-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? '…' : '↺ Refresh'}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {!data ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>
        ) : subTab === 'cookies' ? (
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-card border-b border-border text-muted-foreground text-left">
              <tr>
                {['Name', 'Value', 'Domain', 'Path', 'Secure', 'HttpOnly'].map((h) => (
                  <th key={h} className="px-3 py-1.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cookies.length === 0
                ? <tr><td colSpan={6} className="px-3 py-3 text-muted-foreground text-center">No cookies</td></tr>
                : data.cookies.map((c, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="px-3 py-1 text-primary">{c.name}</td>
                    <td className="px-3 py-1 max-w-48 truncate">{c.value}</td>
                    <td className="px-3 py-1 text-muted-foreground">{c.domain}</td>
                    <td className="px-3 py-1 text-muted-foreground">{c.path}</td>
                    <td className="px-3 py-1 text-center">{c.secure ? '✓' : ''}</td>
                    <td className="px-3 py-1 text-center">{c.httpOnly ? '✓' : ''}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-card border-b border-border text-muted-foreground text-left">
              <tr>
                <th className="px-3 py-1.5 font-medium w-1/3">Key</th>
                <th className="px-3 py-1.5 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(data[subTab]).length === 0
                ? <tr><td colSpan={2} className="px-3 py-3 text-muted-foreground text-center">Empty</td></tr>
                : Object.entries(data[subTab]).map(([k, v]) => (
                  <tr key={k} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="px-3 py-1 text-primary align-top">{k}</td>
                    <td className="px-3 py-1 break-all whitespace-pre-wrap max-h-20 overflow-y-auto">{v}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
