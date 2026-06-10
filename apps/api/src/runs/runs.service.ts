import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { WORKSPACE_RUN_CHANGED } from "@iris/common"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { ArtifactsService } from "../common/artifacts.service"

/**
 * Run queries, cancellation, and workspace run-change notifications.
 * Triggering/enqueueing new runs lives in RunTriggerService.
 */
@Injectable()
export class RunsService {
  constructor(
    private artifacts: ArtifactsService,
    private eventEmitter: EventEmitter2,
    private projectAccess: ProjectAccessService
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
    this.eventEmitter.emit(WORKSPACE_RUN_CHANGED, {
      id: payload.id,
      status: payload.status,
      createdAt:
        payload.createdAt instanceof Date
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

  async findOne(runId: string, userId: string) {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        stepResults: { orderBy: { stepIndex: "asc" } },
        test: { include: { project: true } },
      },
    })

    if (!run) throw new NotFoundException("Run not found")

    await this.projectAccess.verifyMember(run.test.projectId, userId)

    return run
  }

  async findAllForTest(testId: string, userId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { projectId: true },
    })
    if (!test) throw new NotFoundException("Test not found")

    await this.projectAccess.verifyMember(test.projectId, userId)

    return prisma.testRun.findMany({
      where: { testId },
      include: { stepResults: { orderBy: { stepIndex: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  }

  async getFrames(runId: string, userId: string): Promise<string[]> {
    await this.verifyRunAccess(runId, userId)
    return this.artifacts.listFrames(runId)
  }

  async getBrowserEvents(runId: string, userId: string) {
    await this.verifyRunAccess(runId, userId)
    return this.artifacts.getBrowserEvents(runId)
  }

  private async verifyRunAccess(runId: string, userId: string): Promise<void> {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      select: { test: { select: { projectId: true } } },
    })
    if (!run) throw new NotFoundException("Run not found")
    await this.projectAccess.verifyMember(run.test.projectId, userId)
  }

  async findActive(userId: string) {
    const projectIds = await this.getUserProjectIds(userId)

    return prisma.testRun.findMany({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
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
      orderBy: { createdAt: "desc" },
      take: 20,
    })
  }

  async cancel(runId: string, userId: string) {
    const run = await this.findOne(runId, userId)
    if (!["QUEUED", "RUNNING"].includes(run.status)) {
      throw new BadRequestException(
        "Only QUEUED or RUNNING runs can be cancelled"
      )
    }
    await prisma.testRun.update({
      where: { id: runId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    })
    this.emitRunChanged({
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
