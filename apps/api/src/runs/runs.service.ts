import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { prisma } from '../prisma/prisma'
import { QueueService } from '../queue/queue.service'
import { ArtifactsService } from '../common/artifacts.service'
import { FlowsService } from '../flows/flows.service'
import { topologicalSort } from '../tests/prerequisite.util'

const WORKSPACE_RUN_EVENT = 'workspace.run.changed'

@Injectable()
export class RunsService {
  constructor(
    private queue: QueueService,
    private artifacts: ArtifactsService,
    private eventEmitter: EventEmitter2,
    private flows: FlowsService,
  ) {}

  emitRunChanged(payload: {
    id: string
    status: string
    createdAt: Date | string
    testId: string
    testName: string
    projectId: string
    projectName: string
  }) {
    this.eventEmitter.emit(WORKSPACE_RUN_EVENT, {
      id: payload.id,
      status: payload.status,
      createdAt: payload.createdAt instanceof Date
        ? payload.createdAt.toISOString()
        : payload.createdAt,
      test: {
        id: payload.testId,
        name: payload.testName,
        project: { id: payload.projectId, name: payload.projectName },
      },
    })
  }

  async getUserProjectIds(userId: string): Promise<string[]> {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    })
    return memberships.map((m) => m.projectId)
  }

  async triggerTest(testId: string, userId: string, trigger: 'MANUAL' | 'API' = 'MANUAL', apiKeyProjectId?: string, skipPrerequisites = false) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: { include: { members: true } },
        steps: true,
        prerequisites: {
          include: { steps: true, prerequisites: true },
        },
      },
    })

    if (!test) throw new NotFoundException('Test not found')

    // When triggered via API key, ensure the key is scoped to the test's project
    if (apiKeyProjectId && test.projectId !== apiKeyProjectId) {
      throw new ForbiddenException('API key does not belong to this project')
    }

    const member = test.project.members.find((m) => m.userId === userId)
    if (!member) throw new ForbiddenException('Not a project member')
    if (member.role === 'VIEWER') throw new ForbiddenException('Viewers cannot trigger runs')
    if (!test.enabled) throw new BadRequestException('Test is disabled')
    if (test.steps.length === 0) throw new BadRequestException('Add steps before running')

    const projectRunId = `pr_${Date.now()}`

    // When skipPrerequisites=true (e.g. flow execution), pass empty array so the
    // processor skips the prereq phase — the flow connects tests manually instead.
    const prerequisiteRunIds: string[] = []
    if (!skipPrerequisites) {
      for (const prereq of test.prerequisites) {
        const run = await prisma.testRun.create({
          data: { testId: prereq.id, status: 'QUEUED', trigger, projectRunId },
        })
        prerequisiteRunIds.push(run.id)
      }
    }

    const run = await prisma.testRun.create({
      data: { testId: test.id, status: 'QUEUED', trigger, projectRunId },
    })

    this.emitRunChanged({
      id: run.id,
      status: 'QUEUED',
      createdAt: run.createdAt,
      testId: test.id,
      testName: test.name,
      projectId: test.projectId,
      projectName: test.project.name,
    })

    await this.queue.enqueueRun({
      runId: run.id,
      testId: test.id,
      projectRunId,
      prerequisiteRunIds,
    })

    return { runId: run.id, projectRunId }
  }

  async triggerProject(projectId: string, userId: string, trigger: 'MANUAL' | 'API' = 'MANUAL') {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!member) throw new ForbiddenException('Not a project member')
    if (member.role === 'VIEWER') throw new ForbiddenException()

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
    const tests = await prisma.test.findMany({
      where: { projectId, enabled: true },
      include: {
        steps: true,
        prerequisites: { select: { id: true } },
      },
      orderBy: { order: 'asc' },
    })

    if (tests.length === 0) {
      throw new BadRequestException('No enabled tests in this project')
    }

    const projectRunId = `pr_${Date.now()}`

    const sortedIds = topologicalSort(tests)
    const testMap = new Map(tests.map((t) => [t.id, t]))

    const runIdByTestId = new Map<string, string>()
    const primaryRunIds: string[] = []

    for (const testId of sortedIds) {
      const test = testMap.get(testId)
      if (!test || test.steps.length === 0) continue

      const prerequisiteRunIds = test.prerequisites
        .map((p) => runIdByTestId.get(p.id))
        .filter(Boolean) as string[]

      const run = await prisma.testRun.create({
        data: {
          testId,
          status: 'QUEUED',
          trigger,
          projectRunId,
        },
      })

      runIdByTestId.set(testId, run.id)
      primaryRunIds.push(run.id)

      this.emitRunChanged({
        id: run.id,
        status: 'QUEUED',
        createdAt: run.createdAt,
        testId,
        testName: test.name,
        projectId,
        projectName: project?.name ?? '',
      })

      await this.queue.enqueueRun({
        runId: run.id,
        testId,
        projectRunId,
        prerequisiteRunIds,
      })
    }

    return { projectRunId, runIds: primaryRunIds }
  }

  async findOne(runId: string, userId: string) {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        stepResults: { orderBy: { stepIndex: 'asc' } },
        test: {
          include: {
            project: { include: { members: true } },
          },
        },
      },
    })

    if (!run) throw new NotFoundException('Run not found')

    const isMember = run.test.project.members.some((m) => m.userId === userId)
    if (!isMember) throw new ForbiddenException()

    return run
  }

  async findAllForTest(testId: string, userId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { project: { include: { members: true } } },
    })
    if (!test) throw new NotFoundException('Test not found')

    const isMember = test.project.members.some((m) => m.userId === userId)
    if (!isMember) throw new ForbiddenException()

    return prisma.testRun.findMany({
      where: { testId },
      include: { stepResults: { orderBy: { stepIndex: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async getFrames(runId: string, userId: string): Promise<string[]> {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      include: { test: { include: { project: { include: { members: true } } } } },
    })
    if (!run) throw new NotFoundException('Run not found')
    if (!run.test.project.members.some((m) => m.userId === userId)) throw new ForbiddenException()
    return this.artifacts.listFrames(runId)
  }

  async getBrowserEvents(runId: string, userId: string) {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      include: { test: { include: { project: { include: { members: true } } } } },
    })
    if (!run) throw new NotFoundException('Run not found')
    if (!run.test.project.members.some((m) => m.userId === userId)) throw new ForbiddenException()
    return this.artifacts.getBrowserEvents(runId)
  }

  async findActive(userId: string) {
    const projectIds = await this.getUserProjectIds(userId)

    return prisma.testRun.findMany({
      where: {
        status: { in: ['QUEUED', 'RUNNING'] },
        test: { projectId: { in: projectIds } },
      },
      include: {
        test: {
          select: {
            id: true,
            name: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  }

  async cancel(runId: string, userId: string) {
    const run = await this.findOne(runId, userId)
    if (!['QUEUED', 'RUNNING'].includes(run.status)) {
      throw new BadRequestException('Only QUEUED or RUNNING runs can be cancelled')
    }
    await prisma.testRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    })
    this.emitRunChanged({
      id: runId,
      status: 'CANCELLED',
      createdAt: run.createdAt,
      testId: run.test.id,
      testName: run.test.name,
      projectId: run.test.project.id,
      projectName: run.test.project.name,
    })
  }

  async triggerFlow(flowId: string, userId: string) {
    const { order } = await this.flows.getRunOrder(flowId, userId)

    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: { project: true },
    })
    if (!flow) throw new NotFoundException('Flow not found')

    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: flow.projectId } },
    })
    if (!member) throw new ForbiddenException('Not a project member')
    if (member.role === 'VIEWER') throw new ForbiddenException('Viewers cannot trigger runs')

    const projectRunId = `flow_${flowId}_${Date.now()}`

    const runNodeMap: { nodeId: string; runId: string }[] = []
    const flowRunIds: string[] = []

    for (const { nodeId, testId } of order) {
      const run = await prisma.testRun.create({
        data: {
          testId,
          status: 'QUEUED',
          trigger: 'MANUAL',
          projectRunId,
        },
      })
      flowRunIds.push(run.id)
      runNodeMap.push({ nodeId, runId: run.id })

      const test = await prisma.test.findUnique({
        where: { id: testId },
        include: { project: true },
      })

      if (test) {
        this.emitRunChanged({
          id: run.id,
          status: 'QUEUED',
          createdAt: run.createdAt,
          testId,
          testName: test.name,
          projectId: flow.projectId,
          projectName: test.project.name,
        })
      }
    }

    await this.queue.enqueueRun({
      runId: flowRunIds[0]!,
      testId: order[0]!.testId,
      projectRunId,
      flowRunIds,
    })

    return { runs: runNodeMap }
  }
}
