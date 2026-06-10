export type StepAction =
  | 'NAVIGATE' | 'CLICK' | 'FILL' | 'SELECT' | 'CHECK'
  | 'HOVER' | 'PRESS_KEY' | 'WAIT' | 'ASSERT_TEXT'
  | 'ASSERT_VISIBLE' | 'ASSERT_URL' | 'SCROLL'

export type SelectorType = 'CSS' | 'XPATH'
export type StepResult = 'PASSED' | 'FAILED' | 'SKIPPED'
export type RunStatus = 'PASSED' | 'FAILED' | 'CANCELLED'

export interface RunStep {
  id: string
  stepIndex: number
  description?: string
  action: StepAction
  selector?: string
  selectorType?: SelectorType
  value?: string
  waitBefore?: number
  timeoutMs?: number
}

export interface StepLog {
  stepIndex: number
  testStepId: string
  description?: string
  action: StepAction
  selector?: string
  selectorType?: SelectorType
  value?: string
  result: StepResult
  errorMessage?: string
  durationMs: number
}

export interface RunConfig {
  runId: string
  testId: string
  startUrl: string
  steps: RunStep[]
  onStepComplete?: (log: StepLog) => void | Promise<void>
}

export interface RunResult {
  runId: string
  status: RunStatus
  stepLogs: StepLog[]
  errorMessage?: string
  totalDurationMs: number
}
