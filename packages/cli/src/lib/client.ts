export interface RunSummary {
  id: string
  status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED'
  totalSteps: number
  passedSteps: number
  errorMessage?: string
  stepResults?: StepResult[]
  test?: { id: string; name: string }
}

export interface StepResult {
  stepIndex: number
  instruction: string
  description?: string
  result: 'PASSED' | 'FAILED' | 'SKIPPED'
  durationMs: number
  errorMessage?: string
}

export class IrisClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private async request<T>(method: string, path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`${method} ${path} → ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  triggerProject(projectId: string): Promise<{ projectRunId: string; runIds: string[] }> {
    return this.request('POST', `/ci/projects/${projectId}/runs`)
  }

  triggerTest(testId: string): Promise<{ runId: string }> {
    return this.request('POST', `/ci/tests/${testId}/runs`)
  }

  getRun(runId: string): Promise<RunSummary> {
    return this.request('GET', `/ci/runs/${runId}`)
  }

  cancelRun(runId: string): Promise<void> {
    return this.request('POST', `/ci/runs/${runId}/cancel`)
  }
}
