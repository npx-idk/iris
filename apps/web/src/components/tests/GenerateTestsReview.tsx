"use client"

import { useState } from "react"
import type { ExploreResult, GeneratedTest } from "@iris/agent"
import type { Test } from "@/lib/types"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"
import { Checkbox } from "@iris/ui/components/animate-ui/components/radix/checkbox"
import { Badge } from "@iris/ui/components/badge"

/** Review phase of AI test generation: pick which generated tests to save. */
export function GenerateTestsReview({
  result,
  selectedPrereq,
  selected,
  onToggle,
  error,
  saving,
  onBack,
  onSave,
}: {
  result: ExploreResult
  selectedPrereq: Test | undefined
  selected: Set<number>
  onToggle: (i: number) => void
  error: string | null
  saving: boolean
  onBack: () => void
  onSave: () => void
}) {
  return (
    <div className="mt-6 space-y-4 px-1">
      <p className="text-xs text-muted-foreground italic">
        {result.pagePurpose}
      </p>
      {selectedPrereq && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">Prerequisite:</span>
          <span className="text-xs font-medium text-foreground">
            {selectedPrereq.name}
          </span>
          <span className="text-xs text-muted-foreground">
            will be linked to each saved test
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Select the tests you want to save ({selected.size} of{" "}
        {result.tests.length} selected)
      </p>

      <div className="space-y-3">
        {result.tests.map((test, i) => (
          <TestReviewRow
            key={i}
            test={test}
            checked={selected.has(i)}
            onToggle={() => onToggle(i)}
          />
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onSave} disabled={saving || selected.size === 0}>
          {saving
            ? "Saving…"
            : `Save ${selected.size} test${selected.size !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  )
}

function TestReviewRow({
  test,
  checked,
  onToggle,
}: {
  test: GeneratedTest
  checked: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-lg border transition-colors ${checked ? "border-ring bg-card" : "border-border bg-muted/30"}`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-3 py-3">
        <Checkbox
          size="sm"
          checked={checked}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 shrink-0 cursor-pointer"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-card-foreground">
                {test.name}
              </p>
              <Badge variant="outline" className="shrink-0 text-xs">
                {test.steps.length} steps
              </Badge>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {test.description && (
            <p className="mt-0.5 line-clamp-2 text-left text-xs text-muted-foreground">
              {test.description}
            </p>
          )}
        </button>
      </div>

      {/* Steps accordion body */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3">
          <ol className="mt-3 space-y-2">
            {test.steps.map((step) => (
              <li key={step.stepIndex} className="flex gap-2.5 text-xs">
                <span className="w-4 shrink-0 text-right font-mono leading-relaxed text-muted-foreground/50">
                  {step.stepIndex + 1}.
                </span>
                <span className="leading-relaxed text-muted-foreground">
                  {step.instruction}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
