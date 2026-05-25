'use client'

import { RefObject } from 'react'
import Link from 'next/link'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TestWithSteps, TestStep, TestPrerequisite, TestRunStep, WorkspaceVariable } from '@/lib/types'
import { ROUTES } from '@/lib/routes'
import { SavedStepRow, LiveStepCard, ChevronIcon, type LiveStep } from './StepRows'
import { SlashCommandMenu } from './SlashCommandMenu'
import { SessionState } from '@/hooks/useAuthorSession'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { TooltipProvider } from '@workspace/ui/components/tooltip'

type SeekOpts = { fromFlatPos?: number; toFlatPos?: number; navigate?: boolean; label?: string }

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
  getReplayState: (pos: number) => 'running' | 'passed' | 'failed' | null
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
  test, existingSteps, prerequisites, liveSteps,
  collapsedSections, onToggleSection,
  isReady, hasContent, prereqStepCount, getReplayState,
  sessionState, statusLabel, isBusy,
  instruction, stepRunning, stepsEndRef,
  onInstructionChange, onKeyDown, onFocus, onRunStep, onSeek,
  onDeleteStep, onSaveStep, onReorderSteps,
  lastRunStepMap,
  selectedStepId, onSelectStep,
  projectVariables = [], onVariableCreated,
}: StepsPanelProps) {
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleSelect(stepId: string) {
    onSelectStep?.(selectedStepId === stepId ? null : stepId)
  }

  return (
    <>
      <TooltipProvider delayDuration={400}>
        <div className="flex-1 overflow-y-auto p-4">
          {/* Prerequisite steps */}
          {(() => {
            let offset = 0
            return prerequisites.map((prereq) => {
              const prereqOffset = offset
              offset += prereq.steps.length
              const collapsed = collapsedSections.has(prereq.id)
              return (
                <div key={prereq.id} className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <button onClick={() => onToggleSection(prereq.id)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <ChevronIcon collapsed={collapsed} />
                    </button>
                    <Link
                      href={ROUTES.test(prereq.id)} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                    >
                      {prereq.name} ↗
                    </Link>
                    <Badge variant="outline" className="text-xs text-muted-foreground">prerequisite</Badge>
                  </div>
                  {!collapsed && (prereq.steps.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">No steps</p>
                  ) : (
                    prereq.steps.map((step, i) => {
                      const pos = prereqOffset + i
                      return (
                        <SavedStepRow
                          key={step.id} step={step} dimmed replayState={getReplayState(pos)}
                          lastRunStep={lastRunStepMap?.get(step.id)}
                          selected={selectedStepId === step.id}
                          onSelect={() => handleSelect(step.id)}
                          onRunStep={isReady ? () => onSeek({ fromFlatPos: pos, toFlatPos: pos, navigate: false, label: 'Running step…' }) : undefined}
                          onRunTill={isReady ? () => onSeek({ toFlatPos: pos, label: 'Running up to step…' }) : undefined}
                          onRunFrom={isReady ? () => onSeek({ fromFlatPos: pos, navigate: false, label: 'Running from step…' }) : undefined}
                        />
                      )
                    })
                  ))}
                </div>
              )
            })
          })()}

          {/* Main test steps with DnD */}
          {existingSteps.length > 0 && (
            <div className="mb-1">
              <div className="flex items-center gap-1.5 mb-2 mt-1">
                <button onClick={() => onToggleSection('__main__')} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  <ChevronIcon collapsed={collapsedSections.has('__main__')} />
                </button>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{test?.name}</p>
              </div>
              {!collapsedSections.has('__main__') && (
                <DndContext
                  sensors={dndSensors} collisionDetection={closestCenter}
                  onDragEnd={(e: DragEndEvent) => {
                    const { active, over } = e
                    if (over && onReorderSteps) onReorderSteps(String(active.id), String(over.id))
                  }}
                >
                  <SortableContext items={existingSteps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    {existingSteps.map((step, i) => {
                      const pos = prereqStepCount + i
                      return (
                        <SavedStepRow
                          key={step.id} step={step}
                          onDelete={onDeleteStep ? () => onDeleteStep(step.id) : undefined}
                          onSave={onSaveStep ? (instr, desc) => onSaveStep(step.id, instr, desc) : undefined}
                          replayState={getReplayState(pos)}
                          lastRunStep={lastRunStepMap?.get(step.id)}
                          selected={selectedStepId === step.id}
                          onSelect={() => handleSelect(step.id)}
                          onRunStep={isReady ? () => onSeek({ fromFlatPos: pos, toFlatPos: pos, navigate: false, label: 'Running step…' }) : undefined}
                          onRunTill={isReady ? () => onSeek({ toFlatPos: pos, label: 'Running up to step…' }) : undefined}
                          onRunFrom={isReady ? () => onSeek({ fromFlatPos: pos, navigate: false, label: 'Running from step…' }) : undefined}
                          projectVariables={projectVariables}
                          onVariableCreated={onVariableCreated}
                        />
                      )
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {/* Divider between saved and live steps */}
          {hasContent && liveSteps.length > 0 && (
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground px-1">new</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {liveSteps.map((step, i) => <LiveStepCard key={i} step={step} />)}

          {!hasContent && liveSteps.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-sm text-muted-foreground">No steps yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Click the input below to open a live browser and start authoring.</p>
            </div>
          )}

          <div ref={stepsEndRef} />
        </div>
      </TooltipProvider>

      {/* Step input */}
      <div className="border-t border-border p-4 space-y-2 shrink-0">
        <SlashCommandMenu
          value={instruction}
          onChange={onInstructionChange}
          variables={projectVariables}
          onVariableCreated={onVariableCreated ?? (() => {})}
          placeholder={
            sessionState === 'idle' ? 'Click to open a live browser… (type / for commands)'
            : sessionState === 'starting' ? 'Launching browser…'
            : isBusy ? statusLabel || 'Replaying steps…'
            : hasContent ? 'Enter → run   ⌘↵ → replay first   / → insert variable'
            : 'Enter → run step   / → insert variable'
          }
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          disabled={isBusy}
          className="resize-none min-h-[80px]"
        />
        <div className="flex justify-end">
          <Button onClick={() => onRunStep()} disabled={!isReady || !instruction.trim() || stepRunning} size="sm">
            {stepRunning ? 'Running…' : 'Run step ↵'}
          </Button>
        </div>
      </div>
    </>
  )
}
