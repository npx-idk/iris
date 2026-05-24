'use client'

import { RefObject, useState } from 'react'
import { TestStep, TestRunStep, RunStatus } from '@/lib/types'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { Badge } from '@workspace/ui/components/badge'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@workspace/ui/components/tooltip'

interface RunPanelProps {
  runStatus: RunStatus | null
  runSteps: TestRunStep[]
  runError: string | null
  passedCount: number
  totalRunSteps: number
  existingSteps: TestStep[]
  runStepsEndRef: RefObject<HTMLDivElement | null>
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export function RunPanel({ runStatus, runSteps, runError, passedCount, totalRunSteps, existingSteps, runStepsEndRef }: RunPanelProps) {
  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex-1 overflow-y-auto p-4">
        {runStatus && runStatus !== 'QUEUED' && runStatus !== 'RUNNING' && (
          <div className={`rounded-xl border px-4 py-3 mb-3 ${
            runStatus === 'PASSED' ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'
          }`}>
            <p className={`text-sm font-medium ${runStatus === 'PASSED' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
              {runStatus === 'PASSED' ? 'All steps passed' : `${passedCount}/${totalRunSteps} steps passed`}
            </p>
            {runError && <p className="text-xs text-muted-foreground mt-1">{runError}</p>}
          </div>
        )}

        {/* Completed steps */}
        {runSteps.map((step, i) => <RunStepRow key={step.id ?? i} step={step} />)}

        {/* Currently running step (shimmer) */}
        {(runStatus === 'QUEUED' || runStatus === 'RUNNING') && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card mb-1"
            style={{
              backgroundImage: 'linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 6%) 50%, transparent 100%)',
              backgroundSize: '300px 100%',
              backgroundRepeat: 'no-repeat',
              animation: 'shimmer 1.5s linear infinite',
            }}
          >
            <div className="w-2 h-2 mt-0.5 shrink-0 rounded-full bg-primary animate-pulse" />
            <span className="flex-1 text-sm text-card-foreground truncate">
              {existingSteps[runSteps.length]?.description || existingSteps[runSteps.length]?.instruction || 'Running…'}
            </span>
          </div>
        )}

        {/* Queued steps */}
        {(runStatus === 'QUEUED' || runStatus === 'RUNNING') &&
          existingSteps.slice(runSteps.length + 1).map((step) => (
            <div key={step.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/20 mb-1 opacity-40">
              <div className="w-2 h-2 shrink-0 rounded-full bg-muted-foreground/40" />
              <span className="flex-1 text-sm text-muted-foreground truncate">{step.description || step.instruction}</span>
            </div>
          ))
        }

        {runSteps.length === 0 && (runStatus === 'QUEUED' || runStatus === 'RUNNING') && existingSteps.length === 0 && (
          <p className="text-xs text-muted-foreground px-1 py-2">Starting run…</p>
        )}
        <div ref={runStepsEndRef} />
      </div>
    </TooltipProvider>
  )
}

function RunStepRow({ step }: { step: TestRunStep }) {
  const [expanded, setExpanded] = useState(false)
  const passed = step.result === 'PASSED'
  const failed = step.result === 'FAILED'

  return (
    <div className={`rounded-xl border mb-1 bg-card overflow-hidden ${failed ? 'border-destructive/40' : 'border-border'}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => step.screenshotUrl && setExpanded((v) => !v)}
      >
        <div className={`w-2 h-2 mt-0.5 shrink-0 rounded-full ${
          passed ? 'bg-green-500' : failed ? 'bg-destructive' : 'bg-muted-foreground/40'
        }`} />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex-1 min-w-0 text-sm text-card-foreground truncate">
              {step.description || step.instruction}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">{step.instruction}</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2 shrink-0">
          {step.durationMs !== undefined && (
            <span className="text-xs text-muted-foreground">{step.durationMs}ms</span>
          )}
          <Badge variant={passed ? 'secondary' : 'destructive'} className="text-xs">{step.result}</Badge>
          {step.screenshotUrl && (
            <HugeiconsIcon
              icon={expanded ? ArrowDown01Icon : ArrowRight01Icon}
              size={12} color="currentColor" strokeWidth={1.5}
            />
          )}
        </div>
      </div>

      {step.errorMessage && !expanded && (
        <p className="text-xs text-destructive bg-destructive/10 px-4 pb-3 -mt-1">{step.errorMessage}</p>
      )}

      {expanded && step.screenshotUrl && (
        <div className="px-4 pb-4 space-y-2">
          {step.errorMessage && (
            <p className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">{step.errorMessage}</p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={step.screenshotUrl.startsWith('http') ? step.screenshotUrl : `${apiBase}${step.screenshotUrl}`}
            alt="Step screenshot"
            className="w-full rounded-lg border border-border"
          />
        </div>
      )}
    </div>
  )
}
