import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { runTest, createStagehand, StepLog } from '@iris/agent'
import { prisma } from '../prisma/prisma'
import { ArtifactsService } from '../common/artifacts.service'
import { RUN_QUEUE, RunJobPayload } from './queue.constants'
import { RunsService } from '../runs/runs.service'

type BrowserSession = Awaited<ReturnType<typeof createStagehand>>

@Processor(RUN_QUEUE)
export class TestRunProcessor {
  private readonly logger = new Logger(TestRunProcessor.name)

  constructor(
    private eventEmitter: EventEmitter2,
    private artifacts: ArtifactsService,
    private runsService: RunsService,
  ) {}

  @Process({ name: 'execute', concurrency: 3 })
  async handleRun(job: Job<RunJobPayload>): Promise<void> {
    const { runId, prerequisiteRunIds = [], flowRunIds = [] } = job.data
    this.logger.log(`Processing run ${runId}`)

    const env = (process.env.BROWSER_ENV ?? 'LOCAL') as 'LOCAL' | 'BROWSERBASE'

    // One browser session for the entire suite — prerequisites and main test share
    // session/cookies so state set up by a prerequisite (e.g. login) carries over.
    const stagehand = await createStagehand({
      env,
      geminiApiKey: process.env.GEMINI_API_KEY!,
      browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
      browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
    }).catch((err) => {
      this.logger.error(`Failed to launch browser: ${err}`)
      return null
    })

    if (!stagehand) {
      await this.failRun(runId, 'Failed to launch browser session')
      if (flowRunIds.length > 0) {
        await this.cancelRemainingRuns(flowRunIds.slice(1), 'Failed to launch browser session')
      }
      return
    }

    try {
      if (flowRunIds.length > 0) {
        for (const fRunId of flowRunIds) {
          // Check if this run was cancelled before executing
          const dbRun = await prisma.testRun.findUnique({
            where: { id: fRunId },
            select: { status: true },
          })
          if (dbRun?.status === 'CANCELLED') {
            await this.cancelRemainingRuns(flowRunIds.slice(flowRunIds.indexOf(fRunId)), 'Flow execution was cancelled')
            return
          }

          const result = await this.executeRun(fRunId, env, stagehand, async (frameBase64) => {
            this.eventEmitter.emit(`run.${fRunId}.frame`, { runId: fRunId, frameBase64 })
          })

          if (result.status !== 'PASSED') {
            const remaining = flowRunIds.slice(flowRunIds.indexOf(fRunId) + 1)
            await this.cancelRemainingRuns(remaining, `Flow stopped because run ${fRunId} was not PASSED`)
            return
          }
        }
      } else {
        // Notify the main run's page that the browser is live so its canvas activates immediately,
        // even while prerequisites are still executing.
        if (prerequisiteRunIds.length > 0) {
          const liveViewUrl = env === 'LOCAL'
            ? `ws://localhost:${process.env.API_PORT ?? 3000}/sessions/${runId}/stream`
            : null
          this.eventEmitter.emit(`run.${runId}.started`, { runId, liveViewUrl })
        }

        for (const prereqRunId of prerequisiteRunIds) {
          const prereqResult = await this.executeRun(prereqRunId, env, stagehand, async (frameBase64) => {
            this.eventEmitter.emit(`run.${prereqRunId}.frame`, { runId: prereqRunId, frameBase64 })
            // Mirror frames to main run so its canvas shows the prereq phase
            this.eventEmitter.emit(`run.${runId}.frame`, { runId, frameBase64 })
          }, runId)

          if (prereqResult.status !== 'PASSED') {
            await this.failRun(runId, `Prerequisite test failed: ${prereqResult.errorMessage ?? prereqRunId}`)
            return
          }
        }

        await this.executeRun(runId, env, stagehand, async (frameBase64) => {
          this.eventEmitter.emit(`run.${runId}.frame`, { runId, frameBase64 })
        })
      }
    } finally {
      await stagehand.close().catch(() => { })
    }
  }

  private async executeRun(
    runId: string,
    env: 'LOCAL' | 'BROWSERBASE',
    stagehand: BrowserSession,
    onEmitFrame?: (b64: string) => Promise<void>,
    mirrorStepsToRunId?: string,
  ): Promise<{ status: string; errorMessage?: string }> {
    const runRecord = await prisma.testRun.findUnique({
      where: { id: runId },
      select: { testId: true },
    })
    if (!runRecord) {
      this.logger.error(`Run record not found: ${runId}`)
      return { status: 'FAILED', errorMessage: `Run ${runId} not found` }
    }

    const test = await prisma.test.findUnique({
      where: { id: runRecord.testId },
      include: { steps: { orderBy: { stepIndex: 'asc' } }, project: { include: { workspace: true } } },
    })

    if (!test) {
      await this.failRun(runId, 'Test not found')
      return { status: 'FAILED', errorMessage: 'Test not found' }
    }
    if (test.steps.length === 0) {
      await this.failRun(runId, 'Test has no steps')
      return { status: 'FAILED', errorMessage: 'Test has no steps' }
    }

    const workspaceId = test.project.workspace.id
    const workspaceVars = await prisma.workspaceVariable.findMany({ where: { workspaceId } })
    const projectVariables = Object.fromEntries(workspaceVars.map((v) => [v.name, v.value]))

    const localLiveViewUrl = `ws://localhost:${process.env.API_PORT ?? 3000}/sessions/${runId}/stream`

    await prisma.testRun.update({
      where: { id: runId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        browserEnv: env,
        ...(env === 'LOCAL' && { liveViewUrl: localLiveViewUrl }),
      },
    })

    this.eventEmitter.emit(`run.${runId}.started`, {
      runId,
      liveViewUrl: env === 'LOCAL' ? localLiveViewUrl : null,
    })

    this.runsService.emitRunChanged({
      id: runId,
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
      testId: test.id,
      testName: test.name,
      projectId: test.projectId,
      projectName: test.project.name,
    })

    let frameCounter = 0
    const result = await runTest(
      {
        runId,
        testId: runRecord.testId,
        startUrl: test.startUrl ?? test.project.baseUrl,
        steps: test.steps.map((s) => ({
          id: s.id,
          stepIndex: s.stepIndex,
          instruction: s.instruction,
          description: s.description ?? undefined,
          variables: s.variables as Record<string, string> | undefined,
        })),
        env,
        geminiApiKey: process.env.GEMINI_API_KEY!,
        browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
        browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
        projectVariables,
        continueOnFailure: test.continueOnFailure,

        onStepComplete: async (log: StepLog) => {
          // Check if this run has been cancelled
          const checkCancel = await prisma.testRun.findUnique({
            where: { id: runId },
            select: { status: true },
          })
          if (checkCancel?.status === 'CANCELLED') {
            throw new Error('Run cancelled by user')
          }

          let screenshotUrl: string | undefined
          if (log.screenshotBase64) {
            screenshotUrl = await this.artifacts.saveScreenshot(runId, log.stepIndex, log.screenshotBase64).catch(() => undefined)
          }
          const { screenshotBase64: _omit, ...logForEvent } = log
          await prisma.testRunStep.create({
            data: {
              runId,
              stepIndex: log.stepIndex,
              testStepId: log.testStepId,
              instruction: log.instruction,
              description: log.description,
              result: log.result as any,
              cacheStatus: log.cacheStatus,
              durationMs: log.durationMs,
              errorMessage: log.errorMessage,
              screenshotUrl,
              actionsJson: log.actions ? (log.actions as any) : undefined,
            },
          })
          this.eventEmitter.emit(`run.${runId}.step`, { runId, step: { ...logForEvent, screenshotUrl } })
          if (mirrorStepsToRunId) {
            await prisma.testRunStep.create({
              data: {
                runId: mirrorStepsToRunId,
                stepIndex: log.stepIndex,
                testStepId: log.testStepId,
                instruction: log.instruction,
                description: log.description,
                result: log.result as any,
                cacheStatus: log.cacheStatus,
                durationMs: log.durationMs,
                errorMessage: log.errorMessage,
                screenshotUrl,
                actionsJson: log.actions ? (log.actions as any) : undefined,
              },
            })
            this.eventEmitter.emit(`run.${mirrorStepsToRunId}.step`, { runId: mirrorStepsToRunId, step: { ...logForEvent, screenshotUrl } })
          }
        },

        onFrame: async (b64: string) => {
          await onEmitFrame?.(b64)
          await this.artifacts.saveFrame(runId, frameCounter++, b64).catch(() => {})
        },
      },
      stagehand,
    )

    const currentRun = await prisma.testRun.findUnique({
      where: { id: runId },
      select: { status: true },
    })

    const finalStatus = currentRun?.status === 'CANCELLED' ? 'CANCELLED' : (result.status as any)
    const finalErrorMessage = currentRun?.status === 'CANCELLED' ? 'Run cancelled by user' : result.errorMessage

    await prisma.testRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        errorMessage: finalErrorMessage,
        totalSteps: result.stepLogs.length,
        passedSteps: result.stepLogs.filter((s) => s.result === 'PASSED').length,
        liveViewUrl: result.liveViewUrl,
        totalTokens: result.metrics.totalTokens,
        inferenceTimeMs: result.metrics.inferenceTimeMs,
        cacheHits: result.metrics.cacheHits,
      },
    })

    if (result.browserEvents) {
      await this.artifacts.saveBrowserEvents(runId, result.browserEvents).catch(() => {})
    }

    this.eventEmitter.emit(`run.${runId}.completed`, { runId, result: { ...result, status: finalStatus, errorMessage: finalErrorMessage } })
    this.runsService.emitRunChanged({
      id: runId,
      status: finalStatus,
      createdAt: new Date().toISOString(),
      testId: test.id,
      testName: test.name,
      projectId: test.projectId,
      projectName: test.project.name,
    })
    this.logger.log(`Run ${runId}: ${finalStatus}`)

    return { status: finalStatus, errorMessage: finalErrorMessage }
  }

  private async cancelRemainingRuns(runIds: string[], errorMessage: string): Promise<void> {
    for (const runId of runIds) {
      const run = await prisma.testRun.update({
        where: { id: runId },
        data: { status: 'CANCELLED', finishedAt: new Date(), errorMessage },
        include: { test: { include: { project: true } } },
      })
      this.eventEmitter.emit(`run.${runId}.completed`, {
        runId,
        result: { status: 'CANCELLED', errorMessage },
      })
      this.runsService.emitRunChanged({
        id: runId,
        status: 'CANCELLED',
        createdAt: run.createdAt,
        testId: run.test.id,
        testName: run.test.name,
        projectId: run.test.project.id,
        projectName: run.test.project.name,
      })
    }
  }

  private async failRun(runId: string, message: string): Promise<void> {
    await prisma.testRun.update({
      where: { id: runId },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: message },
    })
    this.eventEmitter.emit(`run.${runId}.completed`, {
      runId,
      result: { status: 'FAILED', errorMessage: message },
    })
  }
}
