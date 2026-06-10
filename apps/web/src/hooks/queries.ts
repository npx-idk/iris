"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { ProjectDetail } from "@iris/common"
import type { Test, TestRun, WorkspaceVariable } from "@/lib/types"

/** All tests in a project — shared by the tests page, flow editor, and pickers. */
export function useProjectTests(
  projectId: string | undefined,
  opts: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: ["tests", projectId],
    queryFn: () => api.get<Test[]>(`/projects/${projectId}/tests`),
    enabled: (opts.enabled ?? true) && !!projectId,
  })
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: !!projectId,
  })
}

export function useWorkspaceVariables() {
  return useQuery({
    queryKey: ["workspace-variables"],
    queryFn: () => api.get<WorkspaceVariable[]>("/workspace/variables"),
  })
}

/** One run with step results; pass `refetchInterval` to poll while it executes. */
export function useRun(
  runId: string | null | undefined,
  opts: { refetchInterval?: number | false } = {}
) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.get<TestRun>(`/runs/${runId}`),
    enabled: !!runId,
    refetchInterval: opts.refetchInterval ?? false,
  })
}
