import { chromium } from 'playwright'
import { executeStep } from './executor'
import { RunConfig, RunResult, StepLog } from './types'

export async function runTest(config: RunConfig): Promise<RunResult> {
  const startedAt = Date.now()
  const stepLogs: StepLog[] = []

  if (config.steps.length === 0) {
    return {
      runId: config.runId,
      status: 'FAILED',
      stepLogs: [],
      errorMessage: 'Test has no steps',
      totalDurationMs: 0,
    }
  }

  const browser = await chromium.launch({ headless: true })

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    })
    const page = await context.newPage()

    await page.goto(config.startUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })

    const steps = [...config.steps].sort((a, b) => a.stepIndex - b.stepIndex)

    for (const step of steps) {
      const stepStart = Date.now()
      const result = await executeStep(page, step)
      const log: StepLog = { ...result, durationMs: Date.now() - stepStart }

      stepLogs.push(log)
      await config.onStepComplete?.(log)

      if (log.result === 'FAILED') {
        return {
          runId: config.runId,
          status: 'FAILED',
          stepLogs,
          errorMessage: `Step ${step.stepIndex + 1} failed: ${log.errorMessage}`,
          totalDurationMs: Date.now() - startedAt,
        }
      }

      await page.waitForTimeout(200)
    }

    return {
      runId: config.runId,
      status: 'PASSED',
      stepLogs,
      totalDurationMs: Date.now() - startedAt,
    }
  } finally {
    await browser.close().catch(() => {})
  }
}
