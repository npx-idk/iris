"use client"

import { RefObject } from "react"
import Link from "next/link"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import {
  TestWithSteps,
  TestStep,
  TestPrerequisite,
  TestRunStep,
  WorkspaceVariable,
} from "@/lib/types"
import { ROUTES } from "@/lib/routes"
import { SavedStepRow, LiveStepCard, type LiveStep } from "./StepRows"
import { ChevronIcon } from "@/components/shared/ChevronIcon"
import { SlashCommandMenu } from "./SlashCommandMenu"
import { SessionState } from "@/hooks/useAuthorSession"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"
import { Badge } from "@iris/ui/components/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@iris/ui/components/tooltip"
import {
  TestResults,
  TestResultsHeader,
  TestResultsSummary,
  TestResultsDuration,
  TestResultsProgress,
  TestSuite,
  TestSuiteName,
  TestSuiteContent,
  TestSuiteStats,
} from "@iris/ui/components/ai-elements/test-results"

type SeekOpts = {
  fromFlatPos?: number
  toFlatPos?: number
  navigate?: boolean
  label?: string
}

interface StepsPanelProps {
  test: TestWithSteps | undefined
  existingSteps: TestStep[]
  prerequisites: TestPrerequisite[]
  liveSteps: LiveStep[]
  collapsedSections: Set<string>
  onToggleSection: (id: string) => void
  isReady: boolean
  hasContent: boolean
  prereqStepCount: number
  getReplayState: (pos: number) => "running" | "passed" | "failed" | null
  sessionState: SessionState
  statusLabel: string
  isBusy: boolean
  instruction: string
  stepRunning: boolean
  stepsEndRef: RefObject<HTMLDivElement | null>
  onInstructionChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFocus: () => void
  onRunStep: (override?: string) => void
  onSeek: (opts: SeekOpts) => void
  onDeleteStep?: (id: string) => void
  onSaveStep?: (id: string, instr: string, desc: string) => void
  onReorderSteps?: (activeId: string, overId: string) => void
  lastRunStepMap?: Map<string, TestRunStep>
  selectedStepId?: string | null
  onSelectStep?: (id: string | null) => void
  projectVariables?: WorkspaceVariable[]
  onVariableCreated?: () => void
}

export function StepsPanel({
  test,
  existingSteps,
  prerequisites,
  liveSteps,
  collapsedSections,
  onToggleSection,
  isReady,
  hasContent,
  prereqStepCount,
  getReplayState,
  sessionState,
  statusLabel,
  isBusy,
  instruction,
  stepRunning,
  stepsEndRef,
  onInstructionChange,
  onKeyDown,
  onFocus,
  onRunStep,
  onSeek,
  onDeleteStep,
  onSaveStep,
  onReorderSteps,
  lastRunStepMap,
  selectedStepId,
  onSelectStep,
  projectVariables = [],
  onVariableCreated,
}: StepsPanelProps) {
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  function handleSelect(stepId: string) {
    onSelectStep?.(selectedStepId === stepId ? null : stepId)
  }

  let passed = 0
  let failed = 0
  let skipped = 0
  let running = 0
  let duration = 0
  const allSteps = [...prerequisites.flatMap((p) => p.steps), ...existingSteps]
  const total = allSteps.length

  allSteps.forEach((step, idx) => {
    const rs = getReplayState(idx)
    const ls = lastRunStepMap?.get(step.id)
    if (rs === "passed") passed++
    else if (rs === "failed") failed++
    else if (rs === "running") running++
    else if (ls?.result === "PASSED") passed++
    else if (ls?.result === "FAILED") failed++
    else skipped++

    if (ls?.durationMs) duration += ls.durationMs
  })
  const summary = {
    passed,
    failed,
    skipped: skipped + running,
    total,
    duration,
  }

  return (
    <>
      <TooltipProvider delayDuration={400}>
        <div className="flex-1 overflow-y-auto p-4">
          <TestResults
            summary={summary}
            className="rounded-none border-0 bg-transparent"
          >
            {total > 0 && (
              <>
                <TestResultsHeader className="mb-2 border-b-0 px-0 pt-0 pb-2">
                  <TestResultsSummary />
                  {duration > 0 && <TestResultsDuration />}
                </TestResultsHeader>
                <TestResultsProgress className="mb-6" />
              </>
            )}
            {/* Prerequisite steps */}
            {(() => {
              let offset = 0
              return prerequisites.map((prereq) => {
                const prereqOffset = offset
                offset += prereq.steps.length

                let pPassed = 0,
                  pFailed = 0,
                  pSkipped = 0
                prereq.steps.forEach((s, idx) => {
                  const ls = lastRunStepMap?.get(s.id)
                  if (ls?.result === "PASSED") pPassed++
                  else if (ls?.result === "FAILED") pFailed++
                  else pSkipped++
                })

                const status =
                  pFailed > 0
                    ? "failed"
                    : pPassed === prereq.steps.length && prereq.steps.length > 0
                      ? "passed"
                      : "skipped"

                return (
                  <TestSuite
                    key={prereq.id}
                    name={prereq.name}
                    status={status as any}
                    className="mb-3 overflow-hidden border-border bg-card"
                  >
                    <TestSuiteName>
                      <span className="inline-flex min-w-0 flex-1 items-center gap-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={ROUTES.test(prereq.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center truncate hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate">
                                {prereq.name || prereq.id}
                              </span>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {prereq.name || prereq.id}
                          </TooltipContent>
                        </Tooltip>
                        <Badge
                          variant="outline"
                          className="h-5 shrink-0 bg-muted/50 px-1.5 py-0 text-[10px] font-normal tracking-wider text-muted-foreground uppercase"
                        >
                          Prerequisite
                        </Badge>
                      </span>
                    </TestSuiteName>
                    <TestSuiteContent>
                      {prereq.steps.length === 0 ? (
                        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                          No steps
                        </p>
                      ) : (
                        prereq.steps.map((step, i) => {
                          const pos = prereqOffset + i
                          return (
                            <SavedStepRow
                              key={step.id}
                              step={step}
                              dimmed
                              replayState={getReplayState(pos)}
                              lastRunStep={lastRunStepMap?.get(step.id)}
                              selected={selectedStepId === step.id}
                              onSelect={() => handleSelect(step.id)}
                              onRunStep={
                                isReady
                                  ? () =>
                                      onSeek({
                                        fromFlatPos: pos,
                                        toFlatPos: pos,
                                        navigate: false,
                                        label: "Running step…",
                                      })
                                  : undefined
                              }
                              onRunTill={
                                isReady
                                  ? () =>
                                      onSeek({
                                        toFlatPos: pos,
                                        label: "Running up to step…",
                                      })
                                  : undefined
                              }
                              onRunFrom={
                                isReady
                                  ? () =>
                                      onSeek({
                                        fromFlatPos: pos,
                                        navigate: false,
                                        label: "Running from step…",
                                      })
                                  : undefined
                              }
                            />
                          )
                        })
                      )}
                    </TestSuiteContent>
                  </TestSuite>
                )
              })
            })()}

            {/* Main test steps with DnD */}
            {existingSteps.length > 0 &&
              (() => {
                let mPassed = 0,
                  mFailed = 0,
                  mSkipped = 0
                existingSteps.forEach((s) => {
                  const ls = lastRunStepMap?.get(s.id)
                  if (ls?.result === "PASSED") mPassed++
                  else if (ls?.result === "FAILED") mFailed++
                  else mSkipped++
                })
                const status =
                  mFailed > 0
                    ? "failed"
                    : mPassed === existingSteps.length
                      ? "passed"
                      : "skipped"

                return (
                  <TestSuite
                    name={test?.name || "Main Steps"}
                    status={status as any}
                    defaultOpen
                    className="mb-3 overflow-hidden border-border bg-card"
                  >
                    <TestSuiteName>{test?.name || "Main Steps"}</TestSuiteName>
                    <TestSuiteContent>
                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e: DragEndEvent) => {
                          const { active, over } = e
                          if (over && onReorderSteps)
                            onReorderSteps(String(active.id), String(over.id))
                        }}
                      >
                        <SortableContext
                          items={existingSteps.map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {existingSteps.map((step, i) => {
                            const pos = prereqStepCount + i
                            return (
                              <SavedStepRow
                                key={step.id}
                                step={step}
                                onDelete={
                                  onDeleteStep
                                    ? () => onDeleteStep(step.id)
                                    : undefined
                                }
                                onSave={
                                  onSaveStep
                                    ? (instr, desc) =>
                                        onSaveStep(step.id, instr, desc)
                                    : undefined
                                }
                                replayState={getReplayState(pos)}
                                lastRunStep={lastRunStepMap?.get(step.id)}
                                selected={selectedStepId === step.id}
                                onSelect={() => handleSelect(step.id)}
                                onRunStep={
                                  isReady
                                    ? () =>
                                        onSeek({
                                          fromFlatPos: pos,
                                          toFlatPos: pos,
                                          navigate: false,
                                          label: "Running step…",
                                        })
                                    : undefined
                                }
                                onRunTill={
                                  isReady
                                    ? () =>
                                        onSeek({
                                          toFlatPos: pos,
                                          label: "Running up to step…",
                                        })
                                    : undefined
                                }
                                onRunFrom={
                                  isReady
                                    ? () =>
                                        onSeek({
                                          fromFlatPos: pos,
                                          navigate: false,
                                          label: "Running from step…",
                                        })
                                    : undefined
                                }
                                projectVariables={projectVariables}
                                onVariableCreated={onVariableCreated}
                              />
                            )
                          })}
                        </SortableContext>
                      </DndContext>
                    </TestSuiteContent>
                  </TestSuite>
                )
              })()}

            {/* Divider between saved and live steps */}
            {hasContent && liveSteps.length > 0 && (
              <div className="flex items-center gap-2 py-2">
                <div className="h-px flex-1 bg-border" />
                <span className="px-1 text-xs text-muted-foreground">new</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            {liveSteps.map((step, i) => (
              <LiveStepCard key={i} step={step} />
            ))}

            {!hasContent && liveSteps.length === 0 && (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">No steps yet.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click the input below to open a live browser and start
                  authoring.
                </p>
              </div>
            )}
          </TestResults>

          <div ref={stepsEndRef} />
        </div>
      </TooltipProvider>

      {/* Step input */}
      <div className="shrink-0 border-t border-border bg-muted/10 p-4">
        <div className="relative overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary">
          <SlashCommandMenu
            value={instruction}
            onChange={onInstructionChange}
            variables={projectVariables}
            onVariableCreated={onVariableCreated ?? (() => {})}
            placeholder={
              sessionState === "idle"
                ? "Click to open a live browser… (type / for commands)"
                : sessionState === "starting"
                  ? "Launching browser…"
                  : isBusy
                    ? statusLabel || "Replaying steps…"
                    : hasContent
                      ? "Enter → run   ⌘↵ → replay first   / → insert variable"
                      : "Enter → run step   / → insert variable"
            }
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            disabled={isBusy}
            className="max-h-[120px] min-h-[60px] resize-none border-none bg-transparent p-3 pb-10 text-sm placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="absolute right-2 bottom-2">
            <Button
              onClick={() => onRunStep()}
              disabled={!isReady || !instruction.trim() || stepRunning}
              size="sm"
              className="h-7 bg-primary px-3 text-xs text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {stepRunning ? "Running…" : "Run ↵"}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
