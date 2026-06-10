"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useRun } from "@/hooks/queries"
import { BrowserEventLog, TestRunStep, TestWithSteps } from "@/lib/types"

/**
 * Which run the test editor is showing: the latest finished run by default,
 * or an older one the user picked. Exposes per-step result maps and the
 * recorded browser events for whichever run is active.
 */
export function useRunSelection(test: TestWithSteps | undefined) {
  const lastRunId = test?.runs?.find(
    (r) => r.status === "PASSED" || r.status === "FAILED"
  )?.id
  const { data: lastRunDetails } = useRun(lastRunId)
  const lastRunStepMap = new Map<string, TestRunStep>(
    (lastRunDetails?.stepResults ?? [])
      .filter((s) => s.testStepId)
      .map((s) => [s.testStepId!, s])
  )

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const { data: selectedRunDetails } = useRun(selectedRunId)
  const selectedRunStepMap =
    selectedRunId && selectedRunDetails
      ? new Map<string, TestRunStep>(
          (selectedRunDetails.stepResults ?? [])
            .filter((s) => s.testStepId)
            .map((s) => [s.testStepId!, s])
        )
      : null

  const activeStepMap = selectedRunStepMap ?? lastRunStepMap
  const activeRunId = selectedRunId ?? lastRunId ?? null
  const activeRun = selectedRunId ? selectedRunDetails : lastRunDetails

  const { data: runEvents } = useQuery({
    queryKey: ["run-events", activeRunId],
    queryFn: () => api.get<BrowserEventLog>(`/runs/${activeRunId}/events`),
    enabled: !!activeRunId,
  })

  return {
    selectedRunId,
    setSelectedRunId,
    lastRunId,
    selectedRunDetails,
    activeStepMap,
    activeRunId,
    activeRun,
    runEvents,
  }
}
