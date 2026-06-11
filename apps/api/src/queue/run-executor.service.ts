import { Injectable, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { runTest, createStagehand, StepLog } from "@iris/agent"
import { EVENTS } from "@iris/common"
import { env, localLiveViewUrl } from "../config/env"
import { prisma } from "../prisma/prisma"
import { ArtifactsService } from "../common/artifacts.service"
import { RunsService } from "../runs/runs.service"
import { WorkspaceService } from "../workspace/workspace.service"

export type BrowserSession = Awaited<ReturnType<typeof createStagehand>>

/**
 * Executes a single test run end-to-end against an already-open browser
 * session: loads context, runs the agent, persists step results/artifacts,
 * and emits live events. Queue orchestration lives in TestRunProcessor.
 */
@Injectable()
export class RunExecutorService {
  private readonly logger = new Logger(RunExecutorService.name)

  constructor(
    private eventEmitter: EventEmitter2,
    private artifacts: ArtifactsService,
    private runsService: RunsService,
    private workspace: WorkspaceService
  ) {}

  async executeRun(
    runId: string,
    stagehand: BrowserSession,
    onEmitFrame?: (b64: string) => Promise<void>,
    mirrorStepsToRunId?: string
  ): Promise<{ status: string; errorMessage?: string }> {
    const ctx = await this.loadRunContext(runId)
    if (!ctx)
      return { status: "FAILED", errorMessage: `Run ${runId} not found` }
    if ("error" in ctx) return { status: "FAILED", errorMessage: ctx.error }

    const { test, projectVariables } = ctx
    await this.markRunning(runId, test)

    let frameCounter = 0
    const result = await runTest(
      {
        runId,
        testId: test.id,
        startUrl: test.startUrl ?? test.project.baseUrl,
        steps: test.steps.map((s) => ({
          id: s.id,
          stepIndex: s.stepIndex,
          instruction: s.instruction,
          description: s.description ?? undefined,
          variables: s.variables as Record<string, string> | undefined,
        })),
        ...env.stagehand,
        projectVariables,
        continueOnFailure: test.continueOnFailure,
        viewport: { width: test.viewportWidth, height: test.viewportHeight },

        onStepComplete: async (log: StepLog) => {
          const checkCancel = await prisma.testRun.findUnique({
            where: { id: runId },
            select: { status: true },
          })
          if (checkCancel?.status === "CANCELLED") {
            throw new Error("Run cancelled by user")
          }

          let screenshotUrl: string | undefined
          if (log.screenshotBase64) {
            screenshotUrl = await this.artifacts
              .saveScreenshot(runId, log.stepIndex, log.screenshotBase64)
              .catch(() => undefined)
          }

          await this.persistStep(runId, log, screenshotUrl)
          if (mirrorStepsToRunId) {
            await this.persistStep(mirrorStepsToRunId, log, screenshotUrl)
          }
        },

        onFrame: async (b64: string) => {
          await onEmitFrame?.(b64)
          await this.artifacts
            .saveFrame(runId, frameCounter++, b64)
            .catch(() => {})
        },
      },
      stagehand
    )

    return this.finalizeRun(runId, test, result)
  }

  private async loadRunContext(runId: string): Promise<
    | null
    | { error: string }
    | {
        test: Awaited<ReturnType<typeof prisma.test.findUnique>> & {
          steps: any[]
          project: any
        }
        projectVariables: Record<string, string>
      }
  > {
    const runRecord = await prisma.testRun.findUnique({
      where: { id: runId },
      select: { testId: true },
    })
    if (!runRecord) {
      this.logger.error(`Run record not found: ${runId}`)
      return null
    }

    const test = await prisma.test.findUnique({
      where: { id: runRecord.testId },
      include: {
        steps: { orderBy: { stepIndex: "asc" } },
        project: { include: { workspace: true } },
      },
    })

    if (!test) {
      await this.failRun(runId, "Test not found")
      return { error: "Test not found" }
    }
    if (test.steps.length === 0) {
      await this.failRun(runId, "Test has no steps")
      return { error: "Test has no steps" }
    }

    const projectVariables = await this.workspace.getVariablesMap(
      test.project.workspace.id
    )
    return { test: test as any, projectVariables }
  }

  private async markRunning(
    runId: string,
    test: {
      id: string
      name: string
      projectId: string
      project: { name: string }
    }
  ): Promise<void> {
    const isLocal = env.stagehand.env === "LOCAL"
    const liveViewUrl = isLocal ? localLiveViewUrl(runId) : null

    await prisma.testRun.update({
      where: { id: runId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        browserEnv: env.stagehand.env,
        ...(isLocal && { liveViewUrl }),
      },
    })

    this.eventEmitter.emit(EVENTS.RUN_STARTED(runId), {
      runId,
      liveViewUrl,
    })

    this.runsService.emitRunChanged({
      id: runId,
      status: "RUNNING",
      createdAt: new Date().toISOString(),
      testId: test.id,
      testName: test.name,
      projectId: test.projectId,
      projectName: test.project.name,
    })
  }

  private async finalizeRun(
    runId: string,
    test: {
      id: string
      name: string
      projectId: string
      project: { name: string }
    },
    result: any
  ): Promise<{ status: string; errorMessage?: string }> {
    const currentRun = await prisma.testRun.findUnique({
      where: { id: runId },
      select: { status: true },
    })

    const finalStatus =
      currentRun?.status === "CANCELLED"
        ? "CANCELLED"
        : (result.status as string)
    const finalErrorMessage =
      currentRun?.status === "CANCELLED"
        ? "Run cancelled by user"
        : result.errorMessage

    await prisma.testRun.update({
      where: { id: runId },
      data: {
        status: finalStatus as any,
        finishedAt: new Date(),
        errorMessage: finalErrorMessage,
        totalSteps: result.stepLogs.length,
        passedSteps: result.stepLogs.filter((s: any) => s.result === "PASSED")
          .length,
        liveViewUrl: result.liveViewUrl,
        totalTokens: result.metrics.totalTokens,
        inferenceTimeMs: result.metrics.inferenceTimeMs,
        cacheHits: result.metrics.cacheHits,
      },
    })

    if (result.browserEvents) {
      await this.artifacts
        .saveBrowserEvents(runId, result.browserEvents)
        .catch(() => {})
    }

    this.eventEmitter.emit(EVENTS.RUN_COMPLETED(runId), {
      runId,
      result: {
        ...result,
        status: finalStatus,
        errorMessage: finalErrorMessage,
      },
    })
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

  private async persistStep(
    runId: string,
    log: StepLog,
    screenshotUrl: string | undefined
  ): Promise<void> {
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
    this.eventEmitter.emit(EVENTS.RUN_STEP(runId), {
      runId,
      step: { ...logForEvent, screenshotUrl },
    })
  }

  async cancelRemainingRuns(
    runIds: string[],
    errorMessage: string
  ): Promise<void> {
    for (const runId of runIds) {
      const run = await prisma.testRun.update({
        where: { id: runId },
        data: { status: "CANCELLED", finishedAt: new Date(), errorMessage },
        include: { test: { include: { project: true } } },
      })
      this.eventEmitter.emit(EVENTS.RUN_COMPLETED(runId), {
        runId,
        result: { status: "CANCELLED", errorMessage },
      })
      this.runsService.emitRunChanged({
        id: runId,
        status: "CANCELLED",
        createdAt: run.createdAt,
        testId: run.test.id,
        testName: run.test.name,
        projectId: run.test.project.id,
        projectName: run.test.project.name,
      })
    }
  }

  async failRun(runId: string, message: string): Promise<void> {
    await prisma.testRun.update({
      where: { id: runId },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
    })
    this.eventEmitter.emit(EVENTS.RUN_COMPLETED(runId), {
      runId,
      result: { status: "FAILED", errorMessage: message },
    })
  }
}
