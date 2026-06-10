export const RUN_QUEUE = 'iris.runs'

export interface RunJobPayload {
  runId: string
  testId: string
  projectRunId?: string
  prerequisiteRunIds?: string[]
  flowRunIds?: string[]
}
