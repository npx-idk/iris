import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { createStagehand, executeStep } from "@iris/agent"
import { EVENTS, type BrowserTab } from "@iris/common"
import { env } from "../config/env"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { interpolateVariables } from "../common/variables.util"
import { WorkspaceService } from "../workspace/workspace.service"
import { DispatchInputDto } from "./dto/dispatch-input.dto"
import { BrowserSession } from "./browser-session"
import { SessionRegistry } from "./session-registry"

/**
 * Live test-authoring sessions: starts/stops browser sessions, executes and
 * saves individual steps, and proxies browser interactions (input, navigation,
 * tabs). Step replay/seeking lives in ReplayService.
 */
@Injectable()
export class AuthoringService {
  constructor(
    private eventEmitter: EventEmitter2,
    private projectAccess: ProjectAccessService,
    private workspace: WorkspaceService,
    private registry: SessionRegistry
  ) {}

  async startSession(
    testId: string,
    userId: string
  ): Promise<{ sessionId: string }> {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: true,
        steps: { orderBy: { stepIndex: "asc" } },
        prerequisites: {
          include: { steps: { orderBy: { stepIndex: "asc" } } },
        },
      },
    })
    if (!test) throw new NotFoundException("Test not found")

    await this.projectAccess.verifyMember(test.projectId, userId, true)

    const sessionId = `author_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const stagehand = await createStagehand({ ...env.stagehand })

    const session = new BrowserSession(
      sessionId,
      testId,
      userId,
      stagehand,
      (event) => {
        this.eventEmitter.emit(EVENTS.AUTHOR_BROWSER(sessionId), event)
        // Navigation events also update the tab list
        if (event.kind === "navigation") {
          const s = this.registry.peek(sessionId)
          if (s) this.emitTabsChanged(sessionId, s)
        }
      }
    )

    // Navigate to start URL so the screenshot loop has a page to capture immediately.
    const mainStartUrl = test.startUrl ?? test.project.baseUrl
    await session.gotoUrl(mainStartUrl)

    // Attach CDP listeners to all current pages.
    for (const p of stagehand.context.pages()) await session.attachPage(p)

    session.startScreencast(
      (frameBase64) =>
        this.eventEmitter.emit(EVENTS.RUN_FRAME(sessionId), {
          runId: sessionId,
          frameBase64,
        }),
      () => this.emitTabsChanged(sessionId, session)
    )

    this.registry.set(sessionId, session)
    this.emitTabsChanged(sessionId, session)
    this.eventEmitter.emit(EVENTS.AUTHOR_READY(sessionId), { sessionId })

    return { sessionId }
  }

  async runStep(
    sessionId: string,
    userId: string,
    instruction: string,
    description?: string,
    variables?: Record<string, string>
  ): Promise<{
    result: "PASSED" | "FAILED"
    errorMessage?: string
    durationMs: number
    stepIndex: number
  }> {
    const session = this.registry.get(sessionId, userId)
    if (session.busy)
      throw new ConflictException("Session is busy — wait for replay to finish")

    const start = Date.now()

    const lastStep = await prisma.testStep.findFirst({
      where: { testId: session.testId },
      orderBy: { stepIndex: "desc" },
      select: { stepIndex: true },
    })
    const stepIndex = lastStep !== null ? lastStep.stepIndex + 1 : 0

    try {
      const testRecord = await prisma.test.findUnique({
        where: { id: session.testId },
        select: { project: { select: { workspaceId: true } } },
      })
      const workspaceId = testRecord?.project?.workspaceId
      const varsMap = workspaceId
        ? await this.workspace.getVariablesMap(workspaceId).catch(() => ({}))
        : {}
      const resolvedInstruction = interpolateVariables(instruction, varsMap)

      const actResult = await executeStep(
        session.stagehandInstance,
        resolvedInstruction,
        {
          ...(variables && { variables }),
        }
      )

      if (actResult.success) {
        await prisma.testStep.create({
          data: {
            testId: session.testId,
            stepIndex,
            instruction,
            description: description ?? null,
            variables: variables ?? undefined,
          },
        })
        return { result: "PASSED", durationMs: Date.now() - start, stepIndex }
      }

      return {
        result: "FAILED",
        errorMessage: actResult.message,
        durationMs: Date.now() - start,
        stepIndex,
      }
    } catch (err) {
      return {
        result: "FAILED",
        errorMessage: String(err),
        durationMs: Date.now() - start,
        stepIndex,
      }
    }
  }

  async dispatchInput(
    sessionId: string,
    userId: string,
    dto: DispatchInputDto
  ): Promise<void> {
    const session = this.registry.get(sessionId, userId)
    await session.dispatchInput(dto)
  }

  async getApplicationData(sessionId: string, userId: string) {
    const session = this.registry.get(sessionId, userId)
    return session.getApplicationData()
  }

  async navigate(
    sessionId: string,
    userId: string,
    url: string
  ): Promise<void> {
    const session = this.registry.get(sessionId, userId)
    await session.navigate(url)
  }

  async goBack(sessionId: string, userId: string): Promise<void> {
    const session = this.registry.get(sessionId, userId)
    await session.goBack()
  }

  async goForward(sessionId: string, userId: string): Promise<void> {
    const session = this.registry.get(sessionId, userId)
    await session.goForward()
  }

  async reload(sessionId: string, userId: string): Promise<void> {
    const session = this.registry.get(sessionId, userId)
    await session.reload()
  }

  private emitTabsChanged(sessionId: string, session: BrowserSession): void {
    const tabs: BrowserTab[] = session.getTabs()
    this.eventEmitter.emit(EVENTS.AUTHOR_TABS(sessionId), { sessionId, tabs })
  }

  async listTabs(
    sessionId: string,
    userId: string
  ): Promise<{ tabs: BrowserTab[] }> {
    const session = this.registry.get(sessionId, userId)
    return { tabs: session.getTabs() }
  }

  async newTab(
    sessionId: string,
    userId: string,
    url?: string
  ): Promise<{ targetId: string }> {
    const session = this.registry.get(sessionId, userId)
    const result = await session.newTab(url)
    this.emitTabsChanged(sessionId, session)
    return result
  }

  async activateTab(
    sessionId: string,
    userId: string,
    targetId: string
  ): Promise<void> {
    const session = this.registry.get(sessionId, userId)
    session.activateTab(targetId)
    this.emitTabsChanged(sessionId, session)
  }

  async closeTab(
    sessionId: string,
    userId: string,
    targetId: string
  ): Promise<void> {
    const session = this.registry.get(sessionId, userId)
    await session.closeTab(targetId)
    this.emitTabsChanged(sessionId, session)
  }

  async getDevtoolsUrl(sessionId: string, userId: string) {
    const session = this.registry.get(sessionId, userId)
    return session.getDevtoolsUrl()
  }

  async closeSession(sessionId: string, userId: string): Promise<void> {
    const session = this.registry.peek(sessionId)
    if (!session) return
    if (session.userId !== userId) throw new ForbiddenException()
    await session.close()
    this.registry.delete(sessionId)
  }
}
