import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { createStagehand, executeStep } from '@iris/agent'
import { EVENTS, type BrowserTab } from '@iris/common'
import { prisma } from '../prisma/prisma'
import { DispatchInputDto } from './dto/dispatch-input.dto'
import { BrowserSession } from './browser-session'

@Injectable()
export class AuthoringService {
  private sessions = new Map<string, BrowserSession>()

  constructor(private eventEmitter: EventEmitter2) {}

  private getSession(sessionId: string, userId: string): BrowserSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new NotFoundException('Authoring session not found')
    if (session.userId !== userId) throw new ForbiddenException()
    return session
  }

  async startSession(testId: string, userId: string): Promise<{ sessionId: string }> {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: { include: { members: true } },
        steps: { orderBy: { stepIndex: 'asc' } },
        prerequisites: { include: { steps: { orderBy: { stepIndex: 'asc' } } } },
      },
    })
    if (!test) throw new NotFoundException('Test not found')

    const member = test.project.members.find((m) => m.userId === userId)
    if (!member) throw new ForbiddenException('Not a project member')
    if (member.role === 'VIEWER') throw new ForbiddenException('Viewers cannot author tests')

    const sessionId = `author_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const env = (process.env.BROWSER_ENV ?? 'LOCAL') as 'LOCAL' | 'BROWSERBASE'

    const stagehand = await createStagehand({
      env,
      geminiApiKey: process.env.GEMINI_API_KEY!,
      browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
      browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
    })

    const session = new BrowserSession(sessionId, testId, userId, stagehand, (event) => {
      this.eventEmitter.emit(EVENTS.AUTHOR_BROWSER(sessionId), event)
      // Navigation events also update the tab list
      if (event.kind === 'navigation') {
        const s = this.sessions.get(sessionId)
        if (s) this.emitTabsChanged(sessionId, s)
      }
    })

    // Navigate to start URL so the screenshot loop has a page to capture immediately.
    const mainStartUrl = test.startUrl ?? test.project.baseUrl
    await session.gotoUrl(mainStartUrl)

    // Attach CDP listeners to all current pages.
    for (const p of stagehand.context.pages()) await session.attachPage(p as any)

    session.startScreencast(
      (frameBase64) => this.eventEmitter.emit(EVENTS.RUN_FRAME(sessionId), { runId: sessionId, frameBase64 }),
      () => this.emitTabsChanged(sessionId, session),
    )

    this.sessions.set(sessionId, session)
    this.emitTabsChanged(sessionId, session)
    this.eventEmitter.emit(EVENTS.AUTHOR_READY(sessionId), { sessionId })

    return { sessionId }
  }

  async seek(
    sessionId: string,
    userId: string,
    fromFlatPos?: number,
    toFlatPos?: number,
    navigate = true,
  ): Promise<void> {
    const session = this.getSession(sessionId, userId)
    if (session.busy) throw new ConflictException('Session is busy — wait for the current operation to finish')

    session.busy = true

    const test = await prisma.test.findUnique({
      where: { id: session.testId },
      include: {
        project: true,
        steps: { orderBy: { stepIndex: 'asc' } },
        prerequisites: { include: { steps: { orderBy: { stepIndex: 'asc' } } } },
      },
    })
    if (!test) { session.busy = false; return }

    const workspaceId = test.project.workspaceId
    const workspaceVars = workspaceId
      ? await prisma.workspaceVariable.findMany({ where: { workspaceId } }).catch(() => [])
      : []
    const varsMap: Record<string, string> = Object.fromEntries(workspaceVars.map((v) => [v.name, v.value]))

    const allSegments = this.buildSegments(test, test.steps)
    const flat = allSegments.flatMap((seg) =>
      seg.steps.map((step, i) => ({
        instruction: step.instruction,
        variables: step.variables,
        startUrl: i === 0 ? seg.startUrl : null,
      })),
    )

    const from = fromFlatPos ?? 0
    const to = toFlatPos ?? flat.length - 1
    const slice = flat.slice(from, to + 1).map((s, i) => ({
      ...s,
      startUrl: (!navigate && i === 0) ? null : s.startUrl,
    }))

    const segments: ReplaySegment[] = []
    let current: ReplaySegment | null = null
    for (const step of slice) {
      if (step.startUrl !== null || current === null) {
        current = { startUrl: step.startUrl, steps: [] }
        segments.push(current)
      }
      current.steps.push({ instruction: step.instruction, variables: step.variables })
    }

    this.doReplay(sessionId, session, segments, from, varsMap).catch(() => {})
  }

  private buildSegments(
    test: {
      startUrl: string | null
      project: { baseUrl: string }
      prerequisites: Array<{ startUrl: string | null; steps: Array<{ instruction: string; variables: any }> }>
    },
    mainSteps: Array<{ instruction: string; variables: any }>,
  ): ReplaySegment[] {
    const segments: ReplaySegment[] = []
    for (const prereq of test.prerequisites) {
      segments.push({ startUrl: prereq.startUrl ?? test.project.baseUrl, steps: prereq.steps })
    }
    segments.push({ startUrl: test.startUrl ?? test.project.baseUrl, steps: mainSteps })
    return segments
  }

  private async doReplay(
    sessionId: string,
    session: BrowserSession,
    segments: ReplaySegment[],
    startFlatPos = 0,
    varsMap: Record<string, string> = {},
  ): Promise<void> {
    const interpolate = (s: string) =>
      s.replace(/\{\{(\w+)\}\}/g, (_, k) => varsMap[k] ?? `{{${k}}}`)

    let pos = startFlatPos
    try {
      for (const segment of segments) {
        if (!this.sessions.has(sessionId)) return
        if (segment.startUrl) await session.gotoUrl(segment.startUrl)

        for (const step of segment.steps) {
          if (!this.sessions.has(sessionId)) return
          this.eventEmitter.emit(EVENTS.AUTHOR_STEP_STARTED(sessionId), { sessionId, pos })
          let passed = false
          try {
            const result = await executeStep(session.stagehandInstance, interpolate(step.instruction), {
              ...(step.variables && { variables: step.variables }),
            })
            passed = result.success
          } catch { passed = false }
          this.eventEmitter.emit(EVENTS.AUTHOR_STEP_COMPLETED(sessionId), { sessionId, pos, passed })
          pos++
        }
      }
    } catch {
      // Best-effort — emit ready so the frontend unblocks regardless
    } finally {
      session.busy = false
      this.eventEmitter.emit(EVENTS.AUTHOR_READY(sessionId), { sessionId })
    }
  }

  async runStep(
    sessionId: string,
    userId: string,
    instruction: string,
    description?: string,
    variables?: Record<string, string>,
  ): Promise<{ result: 'PASSED' | 'FAILED'; errorMessage?: string; durationMs: number; stepIndex: number }> {
    const session = this.getSession(sessionId, userId)
    if (session.busy) throw new ConflictException('Session is busy — wait for replay to finish')

    const start = Date.now()

    const lastStep = await prisma.testStep.findFirst({
      where: { testId: session.testId },
      orderBy: { stepIndex: 'desc' },
      select: { stepIndex: true },
    })
    const stepIndex = lastStep !== null ? lastStep.stepIndex + 1 : 0

    try {
      const testRecord = await prisma.test.findUnique({
        where: { id: session.testId },
        select: { project: { select: { workspaceId: true } } },
      })
      const workspaceId = testRecord?.project?.workspaceId
      const workspaceVars = workspaceId
        ? await prisma.workspaceVariable.findMany({ where: { workspaceId } }).catch(() => [])
        : []
      const resolvedInstruction = workspaceVars.length > 0
        ? instruction.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            const found = workspaceVars.find((v) => v.name === key)
            return found ? found.value : `{{${key}}}`
          })
        : instruction

      const actResult = await executeStep(session.stagehandInstance, resolvedInstruction, {
        ...(variables && { variables }),
      })

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
        return { result: 'PASSED', durationMs: Date.now() - start, stepIndex }
      }

      return { result: 'FAILED', errorMessage: actResult.message, durationMs: Date.now() - start, stepIndex }
    } catch (err) {
      return { result: 'FAILED', errorMessage: String(err), durationMs: Date.now() - start, stepIndex }
    }
  }

  async dispatchInput(sessionId: string, userId: string, dto: DispatchInputDto): Promise<void> {
    const session = this.getSession(sessionId, userId)
    await session.dispatchInput(dto)
  }

  async getApplicationData(sessionId: string, userId: string) {
    const session = this.getSession(sessionId, userId)
    return session.getApplicationData()
  }

  async navigate(sessionId: string, userId: string, url: string): Promise<void> {
    const session = this.getSession(sessionId, userId)
    await session.navigate(url)
  }

  async goBack(sessionId: string, userId: string): Promise<void> {
    const session = this.getSession(sessionId, userId)
    await session.goBack()
  }

  async goForward(sessionId: string, userId: string): Promise<void> {
    const session = this.getSession(sessionId, userId)
    await session.goForward()
  }

  async reload(sessionId: string, userId: string): Promise<void> {
    const session = this.getSession(sessionId, userId)
    await session.reload()
  }

  private emitTabsChanged(sessionId: string, session: BrowserSession): void {
    const tabs: BrowserTab[] = session.getTabs()
    this.eventEmitter.emit(EVENTS.AUTHOR_TABS(sessionId), { sessionId, tabs })
  }

  async listTabs(sessionId: string, userId: string): Promise<{ tabs: BrowserTab[] }> {
    const session = this.getSession(sessionId, userId)
    return { tabs: session.getTabs() }
  }

  async newTab(sessionId: string, userId: string, url?: string): Promise<{ targetId: string }> {
    const session = this.getSession(sessionId, userId)
    const result = await session.newTab(url)
    this.emitTabsChanged(sessionId, session)
    return result
  }

  async activateTab(sessionId: string, userId: string, targetId: string): Promise<void> {
    const session = this.getSession(sessionId, userId)
    session.activateTab(targetId)
    this.emitTabsChanged(sessionId, session)
  }

  async closeTab(sessionId: string, userId: string, targetId: string): Promise<void> {
    const session = this.getSession(sessionId, userId)
    await session.closeTab(targetId)
    this.emitTabsChanged(sessionId, session)
  }

  async getDevtoolsUrl(sessionId: string, userId: string) {
    const session = this.getSession(sessionId, userId)
    return session.getDevtoolsUrl()
  }

  async closeSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    if (session.userId !== userId) throw new ForbiddenException()
    await session.close()
    this.sessions.delete(sessionId)
  }
}

interface ReplaySegment {
  startUrl: string | null
  steps: Array<{ instruction: string; variables: any }>
}
