'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DragDropVerticalIcon,
  ArrowDown01Icon, ArrowRight01Icon,
  PlayIcon, NextIcon, PreviousIcon, Cancel01Icon, Edit01Icon,
} from '@hugeicons/core-free-icons'
import { TestStep, TestRunStep, WorkspaceVariable } from '@/lib/types'
import { SlashCommandMenu } from './SlashCommandMenu'

import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export interface LiveStep {
  instruction: string
  result: 'PASSED' | 'FAILED' | 'RUNNING'
  errorMessage?: string
  durationMs?: number
  stepIndex?: number
}

export function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return <HugeiconsIcon icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon} size={12} color="currentColor" strokeWidth={1.5} />
}

function LiveStepDot({ result }: { result: 'PASSED' | 'FAILED' | 'RUNNING' }) {
  if (result === 'RUNNING') {
    return <div className="w-2 h-2 mt-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
  }
  return (
    <div className={`w-2 h-2 mt-1.5 shrink-0 rounded-full ${result === 'PASSED' ? 'bg-green-500' : 'bg-destructive'}`} />
  )
}

// ─── SavedStepRow ─────────────────────────────────────────────────────────────

export function SavedStepRow({
  step,
  onDelete,
  onSave,
  dimmed = false,
  replayState = null,
  lastRunStep,
  selected = false,
  onSelect,
  onRunStep,
  onRunTill,
  onRunFrom,
  projectVariables = [],
  onVariableCreated,
}: {
  step: TestStep
  onDelete?: () => void
  onSave?: (instruction: string, description: string) => void
  dimmed?: boolean
  replayState?: 'running' | 'passed' | 'failed' | null
  lastRunStep?: TestRunStep
  selected?: boolean
  onSelect?: () => void
  onRunStep?: () => void
  onRunTill?: () => void
  onRunFrom?: () => void
  projectVariables?: WorkspaceVariable[]
  onVariableCreated?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id, disabled: dimmed })
  const [editing, setEditing] = useState(false)
  const [editInstruction, setEditInstruction] = useState(step.instruction)
  const [editDescription, setEditDescription] = useState(step.description ?? '')
  const [saving, setSaving] = useState(false)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditInstruction(step.instruction)
    setEditDescription(step.description ?? '')
    setEditing(true)
  }

  async function commitEdit() {
    if (!onSave || !editInstruction.trim()) return
    setSaving(true)
    try {
      await onSave(editInstruction.trim(), editDescription.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setEditing(false)
    setEditInstruction(step.instruction)
    setEditDescription(step.description ?? '')
  }

  const style = { transform: CSS.Transform.toString(transform), transition }
  const canSelect = !replayState

  if (editing) {
    return (
      <div ref={setNodeRef} style={style} className="rounded-xl border border-ring bg-card px-4 py-3 mb-1 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 text-xs bg-transparent border-b border-border focus:border-ring outline-none text-muted-foreground py-0.5"
          />
        </div>
        <SlashCommandMenu
          value={editInstruction}
          onChange={setEditInstruction}
          variables={projectVariables}
          onVariableCreated={onVariableCreated ?? (() => {})}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
            if (e.key === 'Escape') cancelEdit()
          }}
          className="resize-none text-sm min-h-[60px]"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="xs" onClick={cancelEdit} className="text-xs h-6">Cancel</Button>
          <Button size="xs" onClick={commitEdit} disabled={saving || !editInstruction.trim()} className="text-xs h-6">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  const shimmerStyle = replayState === 'running' ? {
    backgroundImage: 'linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 6%) 50%, transparent 100%)',
    backgroundSize: '300px 100%',
    backgroundRepeat: 'no-repeat',
    animation: 'shimmer 1.5s linear infinite',
  } : {}

  // Left border stripe — priority: live replay state > last run result > none
  // CSS vars are oklch so use var() directly, not hsl(var())
  const borderLeft = replayState === 'running'
    ? { borderLeftColor: 'var(--primary)', borderLeftWidth: '2px' }
    : replayState === 'passed'
    ? { borderLeftColor: '#22c55e', borderLeftWidth: '2px' }
    : replayState === 'failed'
    ? { borderLeftColor: 'var(--destructive)', borderLeftWidth: '2px' }
    : lastRunStep?.result === 'PASSED'
    ? { borderLeftColor: '#22c55e', borderLeftWidth: '2px' }
    : lastRunStep?.result === 'FAILED'
    ? { borderLeftColor: 'var(--destructive)', borderLeftWidth: '2px' }
    : {}

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...shimmerStyle, ...borderLeft }}
      className={`group rounded-xl border mb-1 transition-colors ${
        selected ? 'border-primary/50 bg-primary/5' : 'border-border'
      } ${dimmed ? 'bg-muted/20' : selected ? '' : 'bg-muted/30'} ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 ${canSelect ? 'cursor-pointer' : ''}`}
        onClick={() => canSelect && onSelect?.()}
      >
        <button
          {...(dimmed ? {} : { ...attributes, ...listeners })}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={`shrink-0 transition-opacity touch-none select-none ${
            dimmed
              ? 'opacity-0 pointer-events-none'
              : 'opacity-0 group-hover:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing'
          }`}
        >
          <HugeiconsIcon icon={DragDropVerticalIcon} size={14} color="currentColor" strokeWidth={1.5} />
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex-1 min-w-0">
              <span className={`text-sm truncate block ${dimmed ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                {step.description || step.instruction}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {step.instruction}
          </TooltipContent>
        </Tooltip>

        {!replayState && (
          <div className="shrink-0 relative flex items-center justify-end" style={{ minWidth: '3rem' }}>
            <div className="absolute right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
              {onSave && !dimmed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={startEdit} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <HugeiconsIcon icon={Edit01Icon} size={12} color="currentColor" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Edit step</TooltipContent>
                </Tooltip>
              )}
              {onRunStep && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={(e) => { e.stopPropagation(); onRunStep() }} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <HugeiconsIcon icon={PlayIcon} size={12} color="currentColor" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Run this step</TooltipContent>
                </Tooltip>
              )}
              {onRunTill && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={(e) => { e.stopPropagation(); onRunTill() }} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <HugeiconsIcon icon={NextIcon} size={12} color="currentColor" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Run up to here</TooltipContent>
                </Tooltip>
              )}
              {onRunFrom && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={(e) => { e.stopPropagation(); onRunFrom() }} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <HugeiconsIcon icon={PreviousIcon} size={12} color="currentColor" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Run from here</TooltipContent>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1 rounded hover:bg-accent text-destructive transition-colors">
                      <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Delete step</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LiveStepCard ─────────────────────────────────────────────────────────────

export function LiveStepCard({ step }: { step: LiveStep }) {
  return (
    <div
      className={`flex flex-col gap-2 px-4 py-3 rounded-xl border bg-card mb-1 ${
        step.result === 'FAILED' ? 'border-destructive/40' : 'border-border'
      }`}
      style={step.result === 'RUNNING' ? {
        backgroundImage: 'linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 6%) 50%, transparent 100%)',
        backgroundSize: '300px 100%',
        backgroundRepeat: 'no-repeat',
        animation: 'shimmer 1.5s linear infinite',
      } : {}}
    >
      <div className="flex items-center gap-3">
        <LiveStepDot result={step.result} />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex-1 min-w-0 text-sm text-card-foreground truncate cursor-default">
              {step.instruction}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {step.instruction}
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2 shrink-0">
          {step.durationMs !== undefined && (
            <span className="text-xs text-muted-foreground">{step.durationMs}ms</span>
          )}
          {step.result !== 'RUNNING' && (
            <Badge variant={step.result === 'PASSED' ? 'secondary' : 'destructive'} className="text-xs">
              {step.result}
            </Badge>
          )}
        </div>
      </div>
      {step.errorMessage && (
        <p className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded ml-5">
          {step.errorMessage}
        </p>
      )}
    </div>
  )
}

// ─── RunStepRow ───────────────────────────────────────────────────────────────

export function RunStepRow({ step }: { step: TestRunStep }) {
  return (
    <div className={`rounded-xl border px-4 py-3 mb-1 bg-card ${
      step.result === 'FAILED' ? 'border-destructive/40' : 'border-border'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 mt-0.5 shrink-0 rounded-full ${
          step.result === 'PASSED' ? 'bg-green-500' : step.result === 'FAILED' ? 'bg-destructive' : 'bg-muted-foreground/40'
        }`} />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex-1 min-w-0 text-sm text-card-foreground truncate cursor-default">
              {step.description || step.instruction}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {step.instruction}
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2 shrink-0">
          {step.durationMs !== undefined && (
            <span className="text-xs text-muted-foreground">{step.durationMs}ms</span>
          )}
          <Badge variant={step.result === 'PASSED' ? 'secondary' : 'destructive'} className="text-xs">
            {step.result}
          </Badge>
        </div>
      </div>
      {step.errorMessage && (
        <p className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded ml-5 mt-2">
          {step.errorMessage}
        </p>
      )}
    </div>
  )
}
