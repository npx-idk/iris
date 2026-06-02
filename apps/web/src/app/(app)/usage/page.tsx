"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { SidebarTrigger } from "@iris/ui/components/sidebar"
import { Separator } from "@iris/ui/components/separator"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@iris/ui/components/card"
import { Skeleton } from "@iris/ui/components/skeleton"
import { Button } from "@iris/ui/components/button"

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsageResponse {
  period: { days: number; since: string }
  totals: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
    reasoningTokens: number
    cachedTokens: number
    runs: number
    totalSteps: number
    cacheHits: number
    cacheHitRate: number
  }
  daily: { date: string; tokens: number; runs: number }[]
  byProject: {
    projectId: string
    projectName: string
    runs: number
    tokens: number
    cacheHits: number
  }[]
  topTests: {
    testId: string
    testName: string
    projectName: string
    runs: number
    totalTokens: number
    avgTokens: number
  }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

const PERIOD_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
]

// ── Mini bar chart ────────────────────────────────────────────────────────────

function SparkBar({ data }: { data: { date: string; tokens: number }[] }) {
  const max = Math.max(...data.map((d) => d.tokens), 1)
  return (
    <div className="flex h-16 items-end gap-px">
      {data.map((d) => {
        const h = Math.max(2, Math.round((d.tokens / max) * 64))
        return (
          <div key={d.date} className="group relative min-w-0 flex-1">
            <div
              className="w-full rounded-sm bg-primary/60 transition-colors group-hover:bg-primary"
              style={{ height: `${h}px` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="rounded border border-border bg-card px-1.5 py-1 text-[10px] whitespace-nowrap text-foreground shadow-sm">
                <div className="font-medium">{d.date}</div>
                <div>{fmtTokens(d.tokens)} tokens</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ["usage", days],
    queryFn: () => api.get<UsageResponse>(`/workspace/usage?days=${days}`),
  })

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            href={ROUTES.dashboard}
            className="transition-colors hover:text-foreground"
          >
            Projects
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">Usage</span>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.days}
              variant={days === opt.days ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDays(opt.days)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard
            title="Total tokens"
            loading={isLoading}
            value={data ? fmtTokens(data.totals.totalTokens) : "—"}
            sub={data ? `${data.totals.runs} runs` : undefined}
          />
          <SummaryCard
            title="Input tokens"
            loading={isLoading}
            value={data ? fmtTokens(data.totals.promptTokens) : "—"}
            sub="prompt"
          />
          <SummaryCard
            title="Output tokens"
            loading={isLoading}
            value={data ? fmtTokens(data.totals.completionTokens) : "—"}
            sub="completion"
          />
          <SummaryCard
            title="Cache hit rate"
            loading={isLoading}
            value={
              data ? `${(data.totals.cacheHitRate * 100).toFixed(1)}%` : "—"
            }
            sub={
              data
                ? `${data.totals.cacheHits} of ${data.totals.totalSteps} steps`
                : undefined
            }
          />
        </div>

        {/* Daily token chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Daily token usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : data && data.daily.length > 0 ? (
              <SparkBar data={data.daily} />
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No data for this period
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* By project */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                By project
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !data || data.byProject.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  No runs in this period
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">
                        Project
                      </th>
                      <th className="px-4 py-2 text-right font-medium">Runs</th>
                      <th className="px-4 py-2 text-right font-medium">
                        Cache hits
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        Tokens
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProject.map((p) => (
                      <tr
                        key={p.projectId}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                      >
                        <td className="max-w-[140px] truncate px-4 py-2 font-medium text-foreground">
                          {p.projectName}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                          {p.runs}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                          {p.cacheHits}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-foreground tabular-nums">
                          {fmtTokens(p.tokens)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Top tests */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Top tests by token usage
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !data || data.topTests.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  No runs in this period
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Test</th>
                      <th className="px-4 py-2 text-right font-medium">Runs</th>
                      <th className="px-4 py-2 text-right font-medium">Avg</th>
                      <th className="px-4 py-2 text-right font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topTests.map((t) => (
                      <tr
                        key={t.testId}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-2">
                          <Link
                            href={ROUTES.test(t.testId)}
                            className="block max-w-[160px] truncate font-medium text-foreground hover:underline"
                          >
                            {t.testName}
                          </Link>
                          <span className="text-muted-foreground/60">
                            {t.projectName}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                          {t.runs}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                          {fmtTokens(t.avgTokens)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-foreground tabular-nums">
                          {fmtTokens(t.totalTokens)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Token breakdown */}
        {data &&
          (data.totals.promptTokens > 0 || data.totals.reasoningTokens > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Token breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <TokenStat label="Input" value={data.totals.promptTokens} />
                  <TokenStat
                    label="Output"
                    value={data.totals.completionTokens}
                  />
                  {data.totals.cachedTokens > 0 && (
                    <TokenStat
                      label="Cached input"
                      value={data.totals.cachedTokens}
                    />
                  )}
                  {data.totals.reasoningTokens > 0 && (
                    <TokenStat
                      label="Reasoning"
                      value={data.totals.reasoningTokens}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  sub,
  loading,
}: {
  title: string
  value: string
  sub?: string
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="mb-1 text-xs text-muted-foreground">{title}</p>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="text-2xl font-semibold text-foreground tabular-nums">
            {value}
          </p>
        )}
        {sub && !loading && (
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        )}
      </CardContent>
    </Card>
  )
}

function TokenStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground tabular-nums">
        {fmtTokens(value)}
      </p>
    </div>
  )
}
