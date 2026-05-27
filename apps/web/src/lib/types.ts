import type { RunStatus, BrowserTab } from '@iris/common'
export type { ProjectRole, ApiKeyRole, Project, ProjectMember, ApiKey, ProjectDetail, RunStatus, BrowserTab } from '@iris/common';

export type StepResult = 'PASSED' | 'FAILED' | 'SKIPPED'
export type CacheStatus = 'HIT' | 'MISS'

export interface TestPrerequisite {
  id: string
  name: string
  steps: TestStep[]
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  order: number
  createdAt: string
}

export interface Test {
  id: string
  name: string
  description?: string
  startUrl?: string
  enabled: boolean
  continueOnFailure: boolean
  order: number
  tags: string[]
  projectId: string
  folderId?: string | null
  folder?: { id: string; name: string; parentId: string | null } | null
  prerequisites: TestPrerequisite[]
  createdAt: string
  updatedAt: string
  _count?: { steps: number; runs: number }
  runs?: TestRunSummary[]
}

export interface TestWithSteps extends Test {
  steps: TestStep[]
}

export interface TestStep {
  id: string
  stepIndex: number
  instruction: string
  description?: string
  variables?: Record<string, string>
  testId: string
}

export interface TestRunSummary {
  id: string
  status: RunStatus
  totalSteps: number
  passedSteps: number
  createdAt: string
  finishedAt?: string
}

export interface TestRun extends TestRunSummary {
  trigger: string
  errorMessage?: string
  projectRunId?: string
  liveViewUrl?: string
  browserEnv?: string
  totalTokens?: number
  inferenceTimeMs?: number
  cacheHits?: number
  stepResults: TestRunStep[]
  test?: { id: string; name: string; projectId: string }
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
  kind: 'log' | 'info' | 'warn' | 'error'
  message: string
}

export interface BrowserEventLog {
  network: StoredNetworkEntry[]
  console: StoredConsoleEntry[]
}

export interface StepAction {
  selector: string
  description: string
  method: string
  arguments: unknown[]
}

export interface WorkspaceVariable {
  id: string
  name: string
  value: string
  isSecret: boolean
  createdAt: string
  updatedAt: string
}

export interface Flow {
  id: string
  name: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  createdAt: string
  updatedAt: string
}

export interface FlowSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  animated?: boolean
}

export interface ActiveRun {
  id: string
  status: RunStatus
  createdAt: string
  test: {
    id: string
    name: string
    project: { id: string; name: string }
  }
}

export interface TestRunStep {
  id: string
  stepIndex: number
  instruction: string
  description?: string
  result: StepResult
  cacheStatus?: CacheStatus
  errorMessage?: string
  durationMs: number
  screenshotUrl?: string
  actionsJson?: StepAction[]
  testStepId?: string
  createdAt: string
}
