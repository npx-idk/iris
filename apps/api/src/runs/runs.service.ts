import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common'
import { prisma } from '../prisma/prisma'
import { QueueService } from '../queue/queue.service'
import { ArtifactsService } from '../common/artifacts.service'
import { topologicalSort } from '../tests/prerequisite.util'

@Injectable()
export class RunsService {
  constructor(
    private queue: QueueService,
    private artifacts: ArtifactsService,
  ) {}

  async triggerTest(testId: string, userId: string, trigger: 'MANUAL' | 'API' = 'MANUAL', apiKeyProjectId?: string) {
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

    // Create run records for prerequisites (visible in UI) but don't enqueue separate jobs —
    // the main test's job runs them inline in order.
    const prerequisiteRunIds: string[] = []
    for (const prereq of test.prerequisites) {
      const run = await prisma.testRun.create({
        data: { testId: prereq.id, status: 'QUEUED', trigger, projectRunId },
      })
      prerequisiteRunIds.push(run.id)
    }

    const run = await prisma.testRun.create({
      data: { testId: test.id, status: 'QUEUED', trigger, projectRunId },
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

  async cancel(runId: string, userId: string) {
    const run = await this.findOne(runId, userId)
    if (!['QUEUED', 'RUNNING'].includes(run.status)) {
      throw new BadRequestException('Only QUEUED or RUNNING runs can be cancelled')
    }
    await prisma.testRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    })
  }
}
