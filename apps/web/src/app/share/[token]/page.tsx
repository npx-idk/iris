"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { runStatusDot, runStatusText } from "@/lib/run-status"
import type {
  PublicNetworkEntry,
  PublicReport,
  PublicRun,
  PublicRunEvents,
  PublicRunStep,
} from "@/lib/types"
import { FramePlayer } from "@/components/tests/FramePlayer"
import { ConsolePanel } from "@/components/tests/ConsolePanel"
import {
  methodColor,
  statusColor,
  urlPath,
} from "@/components/tests/NetworkPanel"
import { ChevronIcon } from "@/components/shared/ChevronIcon"
import { Badge } from "@iris/ui/components/badge"
import { Skeleton } from "@iris/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@iris/ui/components/animate-ui/components/radix/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@iris/ui/components/animate-ui/components/radix/accordion"

function formatDuration(run: PublicRun): string {
  const start = run.startedAt ?? run.createdAt
  if (!run.finishedAt || !start) return "—"
  const secs =
    (new Date(run.finishedAt).getTime() - new Date(start).getTime()) / 1000
  if (secs < 60) return `${secs.toFixed(1)}s`
  return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 truncate text-sm font-medium text-foreground">
        {value}
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-foreground">{children}</h2>
}

function StepItem({ step }: { step: PublicRunStep }) {
  const hasDetails = !!(
    step.screenshotUrl ||
    step.errorMessage ||
    step.description
  )
  return (
    <AccordionItem
      value={step.id}
      className="border-border px-4 last:border-b-0 sm:px-5"
    >
      <AccordionTrigger
        disabled={!hasDetails}
        showArrow={hasDetails}
        className="py-3.5 font-normal hover:no-underline disabled:opacity-100 sm:py-4"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] text-muted-foreground tabular-nums">
            {step.stepIndex + 1}
          </span>
          <span className="min-w-0 flex-1 text-sm text-foreground">
            {step.instruction}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            {step.cacheStatus === "HIT" && (
              <Badge variant="outline" className="text-[10px]">
                cached
              </Badge>
            )}
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {(step.durationMs / 1000).toFixed(1)}s
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${runStatusText[step.result] ?? "text-muted-foreground"}`}
            >
              <span
                className={`size-1.5 rounded-full ${runStatusDot[step.result] ?? "bg-muted"}`}
              />
              {step.result}
            </span>
          </span>
        </div>
      </AccordionTrigger>
      {hasDetails && (
        <AccordionContent className="pl-9">
          {step.description && (
            <p className="text-xs text-muted-foreground">{step.description}</p>
          )}
          {step.errorMessage && (
            <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 font-mono text-xs break-words text-destructive">
              {step.errorMessage}
            </p>
          )}
          {step.screenshotUrl && (
            <a
              href={step.screenshotUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block w-fit"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.screenshotUrl}
                alt={`Step ${step.stepIndex + 1} screenshot`}
                loading="lazy"
                className="max-h-80 w-auto max-w-full rounded-lg border border-border transition-opacity hover:opacity-90"
              />
            </a>
          )}
        </AccordionContent>
      )}
    </AccordionItem>
  )
}

function NetworkRow({
  entry,
  startedAt,
}: {
  entry: PublicNetworkEntry
  startedAt: number
}) {
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
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
          {urlPath(entry.url)}
        </span>
        <span
          className={`shrink-0 text-[11px] font-medium ${statusColor(entry.status)}`}
        >
          {entry.status ?? "—"}
        </span>
        {entry.duration !== undefined && (
          <span className="hidden w-14 shrink-0 text-right text-[11px] text-muted-foreground sm:inline">
            {entry.duration}ms
          </span>
        )}
        <ChevronIcon collapsed={!expanded} />
      </button>

      {expanded && (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 bg-muted/20 px-3 py-3 font-mono text-[11px]">
          <span className="text-muted-foreground">URL</span>
          <span className="break-all">{entry.url}</span>
          <span className="text-muted-foreground">Type</span>
          <span>{entry.mimeType ?? "—"}</span>
          <span className="text-muted-foreground">Status</span>
          <span className={statusColor(entry.status)}>
            {entry.status ?? "—"}
          </span>
          <span className="text-muted-foreground">Started</span>
          <span>{((entry.timestamp - startedAt) / 1000).toFixed(2)}s</span>
          <span className="text-muted-foreground">Duration</span>
          <span>
            {entry.duration !== undefined ? `${entry.duration}ms` : "—"}
          </span>
        </div>
      )}
    </div>
  )
}

function NetworkLog({ events }: { events: PublicRunEvents }) {
  if (events.network.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
        No network requests recorded.
      </p>
    )
  }
  const startedAt = events.network[0]?.timestamp ?? 0
  return (
    <div>
      {events.network.map((e) => (
        <NetworkRow key={e.id} entry={e} startedAt={startedAt} />
      ))}
    </div>
  )
}

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>()
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const {
    data: report,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-report", token],
    queryFn: () => api.get<PublicReport>(`/public/reports/${token}`),
    retry: false,
  })

  const { data: frames = [] } = useQuery({
    queryKey: ["public-report-frames", token],
    queryFn: () => api.get<string[]>(`/public/reports/${token}/frames`),
    enabled: !!report?.run,
    retry: false,
  })

  const { data: events } = useQuery({
    queryKey: ["public-report-events", token],
    queryFn: () => api.get<PublicRunEvents>(`/public/reports/${token}/events`),
    enabled: !!report?.run,
    retry: false,
  })

  useEffect(() => {
    if (report?.title) document.title = report.title
  }, [report?.title])

  const run = report?.run
  const hasLogs =
    !!events && (events.console.length > 0 || events.network.length > 0)
  const consoleStartedAt =
    events?.console[0]?.timestamp ??
    (run?.startedAt ? new Date(run.startedAt).getTime() : 0)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href={ROUTES.home}
            className="text-sm font-semibold text-foreground"
          >
            Iris
          </Link>
          <Badge variant="secondary" className="text-xs">
            Shared report
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        ) : isError || !report ? (
          <div className="py-24 text-center">
            <h1 className="text-lg font-semibold text-foreground">
              Report not found
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This link may have been revoked, or it never existed.
            </p>
          </div>
        ) : !run ? (
          <div className="py-24 text-center">
            <h1 className="text-lg font-semibold text-foreground">
              {report.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The run behind this report is no longer available.
            </p>
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                {run.test.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${runStatusText[run.status] ?? "text-muted-foreground"}`}
              >
                <span
                  className={`size-2 rounded-full ${runStatusDot[run.status] ?? "bg-muted"}`}
                />
                {run.status}
              </span>
            </div>
            {run.test.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {run.test.description}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Ran {new Date(run.createdAt).toLocaleString()} · Published{" "}
              {new Date(report.updatedAt).toLocaleString()}
            </p>

            {/* Summary */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat
                label="Steps passed"
                value={
                  <span className="tabular-nums">
                    {run.passedSteps} / {run.totalSteps}
                  </span>
                }
              />
              <Stat label="Duration" value={formatDuration(run)} />
              <Stat label="Browser" value={run.browserEnv ?? "Local"} />
              <Stat label="Trigger" value={run.trigger} />
              <Stat
                label="Tokens"
                value={run.totalTokens?.toLocaleString() ?? "—"}
              />
              <Stat
                label="Inference"
                value={
                  run.inferenceTimeMs
                    ? `${(run.inferenceTimeMs / 1000).toFixed(1)}s`
                    : "—"
                }
              />
            </div>

            {/* Failure */}
            {run.errorMessage && (
              <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  Run failed
                </p>
                <p className="mt-1 font-mono text-xs break-words text-destructive/90">
                  {run.errorMessage}
                </p>
              </div>
            )}

            {/* Recording */}
            {frames.length > 0 && (
              <section className="mt-8">
                <SectionHeading>Recording</SectionHeading>
                <FramePlayer
                  frames={frames}
                  className="mt-3"
                  viewportWidth={run.test.viewportWidth}
                  viewportHeight={run.test.viewportHeight}
                />
              </section>
            )}

            {/* Steps */}
            <section className="mt-8">
              <SectionHeading>Steps</SectionHeading>
              {run.stepResults.length === 0 ? (
                <div className="mt-3 rounded-xl border border-border bg-card">
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No steps recorded.
                  </p>
                </div>
              ) : (
                <Accordion
                  type="multiple"
                  defaultValue={run.stepResults
                    .filter((s) => s.result === "FAILED")
                    .map((s) => s.id)}
                  className="mt-3 overflow-hidden rounded-xl border border-border bg-card"
                >
                  {run.stepResults.map((step) => (
                    <StepItem key={step.id} step={step} />
                  ))}
                </Accordion>
              )}
            </section>

            {/* Browser logs */}
            {hasLogs && (
              <section className="mt-8">
                <SectionHeading>Browser logs</SectionHeading>
                <Tabs defaultValue="console" className="mt-3">
                  <TabsList>
                    <TabsTrigger value="console">
                      Console ({events.console.length})
                    </TabsTrigger>
                    <TabsTrigger value="network">
                      Network ({events.network.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="console">
                    <div className="max-h-96 overflow-y-auto rounded-xl border border-border bg-card">
                      {events.console.length === 0 ? (
                        <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                          No console output recorded.
                        </p>
                      ) : (
                        <ConsolePanel
                          entries={events.console}
                          endRef={consoleEndRef}
                          startedAt={consoleStartedAt}
                        />
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="network">
                    <div className="max-h-96 overflow-y-auto rounded-xl border border-border bg-card">
                      <NetworkLog events={events} />
                    </div>
                  </TabsContent>
                </Tabs>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Generated with Iris
      </footer>
    </div>
  )
}
