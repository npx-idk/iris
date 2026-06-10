"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { TestStep, TestRunStep } from "@/lib/types"
import { Button } from "@iris/ui/components/button"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

/** Read-only detail view of one saved step: result, error, selectors, screenshot. */
export function StepDetailsView({
  selectedStep,
  selectedRunStep,
  onClear,
}: {
  selectedStep: TestStep
  selectedRunStep?: TestRunStep
  onClear?: () => void
}) {
  const passed = selectedRunStep?.result === "PASSED"
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-[9px]">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium text-foreground">
            {selectedStep.description || selectedStep.instruction}
          </p>
          {selectedStep.description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {selectedStep.instruction}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="h-8 w-8 shrink-0 text-muted-foreground"
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
          />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {!selectedRunStep ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <p className="text-sm text-muted-foreground">
              This step has not been run yet
            </p>
            <p className="text-xs text-muted-foreground/60">
              Run the test to see results here
            </p>
          </div>
        ) : (
          <>
            {/* Result row */}
            <div className="flex items-center gap-3">
              <div
                className={`h-2 w-2 shrink-0 rounded-full ${passed ? "bg-primary" : "bg-destructive"}`}
              />
              <span
                className={`text-sm font-medium ${passed ? "text-primary" : "text-destructive"}`}
              >
                {passed ? "Passed" : "Failed"}
              </span>
              {selectedRunStep.durationMs !== undefined && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {selectedRunStep.durationMs}ms
                </span>
              )}
            </div>

            {/* Error / reason */}
            {selectedRunStep.errorMessage && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                <p className="mb-1 text-xs font-medium text-destructive">
                  Reason
                </p>
                <p className="text-xs leading-relaxed text-destructive/90">
                  {selectedRunStep.errorMessage}
                </p>
              </div>
            )}

            {/* Selectors */}
            {passed &&
              selectedRunStep.actionsJson &&
              selectedRunStep.actionsJson.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {selectedRunStep.actionsJson.length === 1
                      ? "Selector"
                      : "Selectors"}
                  </p>
                  <div className="space-y-2">
                    {selectedRunStep.actionsJson.map((action, i) => (
                      <div
                        key={i}
                        className="space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {action.method}
                          </span>
                          {action.description && (
                            <span className="text-xs text-muted-foreground">
                              — {action.description}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs leading-relaxed break-all text-muted-foreground">
                          {action.selector}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Screenshot */}
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Screenshot
              </p>
              {selectedRunStep.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    selectedRunStep.screenshotUrl.startsWith("http")
                      ? selectedRunStep.screenshotUrl
                      : `${API_BASE}${selectedRunStep.screenshotUrl}`
                  }
                  alt="Step screenshot"
                  className="w-full rounded-xl border border-border object-contain"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">
                    No screenshot captured
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
