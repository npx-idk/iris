import { Process, Processor } from "@nestjs/bull"
import { Logger } from "@nestjs/common"
import { Job } from "bull"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { createStagehand } from "@iris/agent"
import { EVENTS } from "@iris/common"
import { env, localLiveViewUrl } from "../config/env"
import { prisma } from "../prisma/prisma"
import { RUN_QUEUE, RunJobPayload } from "./queue.constants"
import { RunExecutorService } from "./run-executor.service"

/**
 * Bull consumer for the run queue. Owns the browser session lifecycle and the
 * ordering rules (flow chains, prerequisites); per-run execution is delegated
 * to RunExecutorService.
 */
@Processor(RUN_QUEUE)
export class TestRunProcessor {
  private readonly logger = new Logger(TestRunProcessor.name)

  constructor(
    private eventEmitter: EventEmitter2,
    private executor: RunExecutorService
  ) {}

  @Process({ name: "execute", concurrency: 3 })
  async handleRun(job: Job<RunJobPayload>): Promise<void> {
    const { runId, prerequisiteRunIds = [], flowRunIds = [] } = job.data
    this.logger.log(`Processing run ${runId}`)

    // One browser session for the entire suite — prerequisites and main test share
    // session/cookies so state set up by a prerequisite (e.g. login) carries over.
    const stagehand = await createStagehand({ ...env.stagehand }).catch(
      (err) => {
        this.logger.error(`Failed to launch browser: ${err}`)
        return null
      }
    )

    if (!stagehand) {
      await this.executor.failRun(runId, "Failed to launch browser session")
      if (flowRunIds.length > 0) {
        await this.executor.cancelRemainingRuns(
          flowRunIds.slice(1),
          "Failed to launch browser session"
        )
      }
      return
    }

    try {
      if (flowRunIds.length > 0) {
        await this.runFlowChain(flowRunIds, stagehand)
      } else {
        await this.runWithPrerequisites(runId, prerequisiteRunIds, stagehand)
      }
    } finally {
      await stagehand.close().catch(() => {})
    }
  }

  /** Runs a flow's tests in order, stopping (and cancelling the rest) on failure. */
  private async runFlowChain(
    flowRunIds: string[],
    stagehand: NonNullable<Awaited<ReturnType<typeof createStagehand>>>
  ): Promise<void> {
    for (const fRunId of flowRunIds) {
      // Check if this run was cancelled before executing
      const dbRun = await prisma.testRun.findUnique({
        where: { id: fRunId },
        select: { status: true },
      })
      if (dbRun?.status === "CANCELLED") {
        await this.executor.cancelRemainingRuns(
          flowRunIds.slice(flowRunIds.indexOf(fRunId)),
          "Flow execution was cancelled"
        )
        return
      }

      const result = await this.executor.executeRun(
        fRunId,
        stagehand,
        async (frameBase64) => {
          this.eventEmitter.emit(EVENTS.RUN_FRAME(fRunId), {
            runId: fRunId,
            frameBase64,
          })
        }
      )

      if (result.status !== "PASSED") {
        const remaining = flowRunIds.slice(flowRunIds.indexOf(fRunId) + 1)
        await this.executor.cancelRemainingRuns(
          remaining,
          `Flow stopped because run ${fRunId} was not PASSED`
        )
        return
      }
    }
  }

  /** Runs a test's prerequisites first, then the main run; fails fast if a prereq fails. */
  private async runWithPrerequisites(
    runId: string,
    prerequisiteRunIds: string[],
    stagehand: NonNullable<Awaited<ReturnType<typeof createStagehand>>>
  ): Promise<void> {
    // Notify the main run's page that the browser is live so its canvas activates immediately,
    // even while prerequisites are still executing.
    if (prerequisiteRunIds.length > 0) {
      const liveViewUrl =
        env.stagehand.env === "LOCAL" ? localLiveViewUrl(runId) : null
      this.eventEmitter.emit(EVENTS.RUN_STARTED(runId), { runId, liveViewUrl })
    }

    for (const prereqRunId of prerequisiteRunIds) {
      const prereqResult = await this.executor.executeRun(
        prereqRunId,
        stagehand,
        async (frameBase64) => {
          this.eventEmitter.emit(EVENTS.RUN_FRAME(prereqRunId), {
            runId: prereqRunId,
            frameBase64,
          })
          // Mirror frames to main run so its canvas shows the prereq phase
          this.eventEmitter.emit(EVENTS.RUN_FRAME(runId), {
            runId,
            frameBase64,
          })
        },
        runId
      )

      if (prereqResult.status !== "PASSED") {
        await this.executor.failRun(
          runId,
          `Prerequisite test failed: ${prereqResult.errorMessage ?? prereqRunId}`
        )
        return
      }
    }

    await this.executor.executeRun(runId, stagehand, async (frameBase64) => {
      this.eventEmitter.emit(EVENTS.RUN_FRAME(runId), { runId, frameBase64 })
    })
  }
}
