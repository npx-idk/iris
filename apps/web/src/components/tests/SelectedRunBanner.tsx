"use client"

import { TestRun } from "@/lib/types"
import { Button } from "@iris/ui/components/button"

/** Banner shown while viewing a historical run instead of the latest one. */
export function SelectedRunBanner({
  selectedRunDetails,
  onBackToLatest,
}: {
  selectedRunDetails: TestRun | undefined
  onBackToLatest: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-4 py-2">
      <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" />
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        Viewing run from{" "}
        {selectedRunDetails
          ? new Date(selectedRunDetails.createdAt).toLocaleString()
          : "…"}
        {selectedRunDetails && (
          <>
            {" "}
            ·{" "}
            <span
              className={
                selectedRunDetails.status === "PASSED"
                  ? "text-primary"
                  : "text-destructive"
              }
            >
              {selectedRunDetails.status}
            </span>{" "}
            · {selectedRunDetails.passedSteps}/{selectedRunDetails.totalSteps}{" "}
            steps
          </>
        )}
      </span>
      <Button
        variant="ghost"
        size="xs"
        onClick={onBackToLatest}
        className="shrink-0 text-xs text-muted-foreground"
      >
        ✕ Back to latest
      </Button>
    </div>
  )
}
