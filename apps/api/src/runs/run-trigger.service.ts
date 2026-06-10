import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { QueueService } from "../queue/queue.service"
import { FlowsService } from "../flows/flows.service"
import { topologicalSort } from "../tests/prerequisite.util"
import { RunsService } from "./runs.service"

export interface TriggerTestOptions {
  trigger?: "MANUAL" | "API"
  apiKeyProjectId?: string
  skipPrerequisites?: boolean
}

type RunIdentity = {
  testId: string
  testName: string
  projectId: string
  projectName: string
}

/**
 * Creates queued run records and enqueues them in the right order — single
 * tests (with prerequisites), whole projects (topologically sorted), and
 * flows. Run queries/cancellation live in RunsService.
 */
@Injectable()
export class RunTriggerService {
  constructor(
    private queue: QueueService,
    private flows: FlowsService,
    private projectAccess: ProjectAccessService,
    private runs: RunsService
  ) {}

  private async createQueuedRun(
    identity: RunIdentity,
    trigger: "MANUAL" | "API",
    projectRunId: string
  ) {
    const run = await prisma.testRun.create({
      data: {
        testId: identity.testId,
        status: "QUEUED",
        trigger,
        projectRunId,
      },
    })

    this.runs.emitRunChanged({
      id: run.id,
      status: "QUEUED",
      createdAt: run.createdAt,
      testId: identity.testId,
      testName: identity.testName,
      projectId: identity.projectId,
      projectName: identity.projectName,
    })

    return run
  }

  async triggerTest(
    testId: string,
    userId: string,
    opts: TriggerTestOptions = {}
  ) {
    const {
      trigger = "MANUAL",
      apiKeyProjectId,
      skipPrerequisites = false,
    } = opts

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: true,
        steps: true,
        prerequisites: {
          include: { steps: true, prerequisites: true },
        },
      },
    })

    if (!test) throw new NotFoundException("Test not found")

    if (apiKeyProjectId && test.projectId !== apiKeyProjectId) {
      throw new NotFoundException("Test not found")
    }

    await this.projectAccess.verifyMember(test.projectId, userId, true)

    if (!test.enabled) throw new BadRequestException("Test is disabled")
    if (test.steps.length === 0)
      throw new BadRequestException("Add steps before running")

    const projectRunId = `pr_${Date.now()}`

    const prerequisiteRunIds: string[] = []
    if (!skipPrerequisites) {
      for (const prereq of test.prerequisites) {
        // Prereq runs intentionally don't emit run.changed here; they surface in the
        // workspace stream when the processor flips them to RUNNING.
        const run = await prisma.testRun.create({
          data: { testId: prereq.id, status: "QUEUED", trigger, projectRunId },
        })
        prerequisiteRunIds.push(run.id)
      }
    }

    const run = await this.createQueuedRun(
      {
        testId: test.id,
        testName: test.name,
        projectId: test.projectId,
        projectName: test.project.name,
      },
      trigger,
      projectRunId
    )

    await this.queue.enqueueRun({
      runId: run.id,
      testId: test.id,
      projectRunId,
      prerequisiteRunIds,
    })

    return { runId: run.id, projectRunId }
  }

  async triggerProject(
    projectId: string,
    userId: string,
    trigger: "MANUAL" | "API" = "MANUAL"
  ) {
    await this.projectAccess.verifyMember(projectId, userId, true)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    })
    const tests = await prisma.test.findMany({
      where: { projectId, enabled: true },
      include: {
        steps: true,
        prerequisites: { select: { id: true } },
      },
      orderBy: { order: "asc" },
    })

    if (tests.length === 0) {
      throw new BadRequestException("No enabled tests in this project")
    }

    const projectRunId = `pr_${Date.now()}`
    const projectName = project?.name ?? ""

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

      const run = await this.createQueuedRun(
        { testId, testName: test.name, projectId, projectName },
        trigger,
        projectRunId
      )

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

  async triggerFlow(flowId: string, userId: string) {
    const { order } = await this.flows.getRunOrder(flowId, userId)

    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: { project: true },
    })
    if (!flow) throw new NotFoundException("Flow not found")

    await this.projectAccess.verifyMember(flow.projectId, userId, true)

    const projectRunId = `flow_${flowId}_${Date.now()}`

    const testIds = order.map((o) => o.testId)
    const tests = await prisma.test.findMany({
      where: { id: { in: testIds } },
      include: { project: true },
    })
    const testMap = new Map(tests.map((t) => [t.id, t]))

    const runNodeMap: { nodeId: string; runId: string }[] = []
    const flowRunIds: string[] = []

    for (const { nodeId, testId } of order) {
      const test = testMap.get(testId)
      if (!test) continue

      const run = await this.createQueuedRun(
        {
          testId,
          testName: test.name,
          projectId: flow.projectId,
          projectName: test.project.name,
        },
        "MANUAL",
        projectRunId
      )

      flowRunIds.push(run.id)
      runNodeMap.push({ nodeId, runId: run.id })
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
