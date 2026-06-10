import { Injectable, ConflictException, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { executeStep } from "@iris/agent"
import { EVENTS } from "@iris/common"
import { prisma } from "../prisma/prisma"
import { interpolateVariables } from "../common/variables.util"
import { WorkspaceService } from "../workspace/workspace.service"
import { BrowserSession } from "./browser-session"
import { SessionRegistry } from "./session-registry"

interface ReplaySegment {
  startUrl: string | null
  steps: Array<{ instruction: string; variables: any }>
}

/**
 * Replays saved test steps (prerequisites + main test) inside a live
 * authoring session so the author can "seek" the browser to any step.
 */
@Injectable()
export class ReplayService {
  private readonly logger = new Logger(ReplayService.name)

  constructor(
    private eventEmitter: EventEmitter2,
    private workspace: WorkspaceService,
    private registry: SessionRegistry
  ) {}

  async seek(
    sessionId: string,
    userId: string,
    fromFlatPos?: number,
    toFlatPos?: number,
    navigate = true
  ): Promise<void> {
    const session = this.registry.get(sessionId, userId)
    if (session.busy)
      throw new ConflictException(
        "Session is busy — wait for the current operation to finish"
      )

    session.busy = true

    const test = await prisma.test.findUnique({
      where: { id: session.testId },
      include: {
        project: true,
        steps: { orderBy: { stepIndex: "asc" } },
        prerequisites: {
          include: { steps: { orderBy: { stepIndex: "asc" } } },
        },
      },
    })
    if (!test) {
      session.busy = false
      return
    }

    const workspaceId = test.project.workspaceId
    const varsMap = workspaceId
      ? await this.workspace.getVariablesMap(workspaceId).catch(() => ({}))
      : {}

    const allSegments = this.buildSegments(test, test.steps)
    const flat = allSegments.flatMap((seg) =>
      seg.steps.map((step, i) => ({
        instruction: step.instruction,
        variables: step.variables,
        startUrl: i === 0 ? seg.startUrl : null,
      }))
    )

    const from = fromFlatPos ?? 0
    const to = toFlatPos ?? flat.length - 1
    const slice = flat.slice(from, to + 1).map((s, i) => ({
      ...s,
      startUrl: !navigate && i === 0 ? null : s.startUrl,
    }))

    const segments: ReplaySegment[] = []
    let current: ReplaySegment | null = null
    for (const step of slice) {
      if (step.startUrl !== null || current === null) {
        current = { startUrl: step.startUrl, steps: [] }
        segments.push(current)
      }
      current.steps.push({
        instruction: step.instruction,
        variables: step.variables,
      })
    }

    this.doReplay(sessionId, session, segments, from, varsMap).catch((err) =>
      this.logger.error(`Replay crashed for session ${sessionId}: ${err}`)
    )
  }

  private buildSegments(
    test: {
      startUrl: string | null
      project: { baseUrl: string }
      prerequisites: Array<{
        startUrl: string | null
        steps: Array<{ instruction: string; variables: any }>
      }>
    },
    mainSteps: Array<{ instruction: string; variables: any }>
  ): ReplaySegment[] {
    const segments: ReplaySegment[] = []
    for (const prereq of test.prerequisites) {
      segments.push({
        startUrl: prereq.startUrl ?? test.project.baseUrl,
        steps: prereq.steps,
      })
    }
    segments.push({
      startUrl: test.startUrl ?? test.project.baseUrl,
      steps: mainSteps,
    })
    return segments
  }

  private async doReplay(
    sessionId: string,
    session: BrowserSession,
    segments: ReplaySegment[],
    startFlatPos = 0,
    varsMap: Record<string, string> = {}
  ): Promise<void> {
    let pos = startFlatPos
    try {
      for (const segment of segments) {
        if (!this.registry.has(sessionId)) return
        if (segment.startUrl) await session.gotoUrl(segment.startUrl)

        for (const step of segment.steps) {
          if (!this.registry.has(sessionId)) return
          this.eventEmitter.emit(EVENTS.AUTHOR_STEP_STARTED(sessionId), {
            sessionId,
            pos,
          })
          let passed = false
          try {
            const result = await executeStep(
              session.stagehandInstance,
              interpolateVariables(step.instruction, varsMap),
              {
                ...(step.variables && { variables: step.variables }),
              }
            )
            passed = result.success
          } catch {
            passed = false
          }
          this.eventEmitter.emit(EVENTS.AUTHOR_STEP_COMPLETED(sessionId), {
            sessionId,
            pos,
            passed,
          })
          pos++
        }
      }
    } catch (err) {
      // Best-effort — emit ready so the frontend unblocks regardless
      this.logger.warn(`Replay aborted for session ${sessionId}: ${err}`)
    } finally {
      session.busy = false
      this.eventEmitter.emit(EVENTS.AUTHOR_READY(sessionId), { sessionId })
    }
  }
}
