export type StepResult = "PASSED" | "FAILED" | "SKIPPED"
// Terminal statuses only — matches CompletedRunStatus from @iris/common
export type RunStatus = "PASSED" | "FAILED" | "CANCELLED"
export type BrowserEnv = "LOCAL" | "BROWSERBASE"
export type CacheStatus = "HIT" | "MISS" | undefined

export interface AgentStep {
  id: string
  stepIndex: number
  instruction: string
  description?: string
  variables?: Record<string, string>
}

export interface StepAction {
  selector: string
  description: string
  method: string
  arguments: unknown[]
}

export interface MetricsSnapshot {
  totalPromptTokens: number
  totalCompletionTokens: number
  totalReasoningTokens: number
  totalCachedInputTokens: number
  totalInferenceTimeMs: number
}

export interface StepLog {
  stepIndex: number
  testStepId: string
  instruction: string
  description?: string
  result: StepResult
  cacheStatus?: CacheStatus
  errorMessage?: string
  durationMs: number
  screenshotBase64?: string
  actions?: StepAction[]
  metricsSnapshot?: MetricsSnapshot
}

export interface RunMetrics {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  cachedTokens: number
  inferenceTimeMs: number
  cacheHits: number
  cacheMisses: number
}

export interface RunResult {
  runId: string
  status: RunStatus
  stepLogs: StepLog[]
  metrics: RunMetrics
  liveViewUrl?: string
  errorMessage?: string
  totalDurationMs: number
  browserEvents?: BrowserEventLog
}

export interface StoredNetworkEntry {
  id: string
  timestamp: number
  method: string
  url: string
  status: number
  mimeType: string
  duration?: number
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBody?: string
  responseBody?: string
}

export interface StoredConsoleEntry {
  id: string
  timestamp: number
  kind: "log" | "info" | "warn" | "error"
  message: string
}

export interface BrowserEventLog {
  network: StoredNetworkEntry[]
  console: StoredConsoleEntry[]
}

export interface RunConfig {
  runId: string
  testId: string
  startUrl: string
  steps: AgentStep[]
  projectVariables?: Record<string, string>
  env: BrowserEnv
  geminiApiKey: string
  modelName?: string
  heliconeApiKey?: string
  heliconeBaseUrl?: string
  browserbaseApiKey?: string
  browserbaseProjectId?: string
  continueOnFailure?: boolean
  onStepComplete?: (log: StepLog) => void | Promise<void>
  onFrame?: (frameBase64: string) => void | Promise<void>
}
