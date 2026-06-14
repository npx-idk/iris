import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common"
import { randomBytes } from "crypto"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { ArtifactsService } from "../common/artifacts.service"

/**
 * Publishing run reports as public pages. A shared report is a snapshot of the
 * report content at share time — one per run, re-sharing updates the snapshot
 * while keeping the same token (and therefore the same public URL).
 */
@Injectable()
export class ReportsService {
  constructor(
    private projectAccess: ProjectAccessService,
    private artifacts: ArtifactsService
  ) {}

  async share(userId: string, runId: string, title: string, content: object[]) {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      select: { test: { select: { projectId: true } } },
    })
    if (!run) throw new NotFoundException("Run not found")
    await this.projectAccess.verifyMember(run.test.projectId, userId)

    const token = randomBytes(24).toString("base64url")
    return prisma.sharedReport.upsert({
      where: { runId },
      create: { runId, userId, title, content, token },
      update: { title, content },
      select: { token: true, createdAt: true, updatedAt: true },
    })
  }

  async revoke(userId: string, runId: string) {
    const report = await prisma.sharedReport.findUnique({
      where: { runId },
      select: { userId: true },
    })
    if (!report) throw new NotFoundException("Shared report not found")

    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      select: { test: { select: { projectId: true } } },
    })
    // If the run was deleted after sharing, membership can no longer be
    // checked through it — only the original sharer may revoke.
    if (run) {
      await this.projectAccess.verifyMember(run.test.projectId, userId)
    } else if (report.userId !== userId) {
      throw new ForbiddenException("Not the sharer of this report")
    }

    await prisma.sharedReport.delete({ where: { runId } })
  }

  async findShareForRun(runId: string, userId: string) {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      select: { test: { select: { projectId: true } } },
    })
    if (!run) throw new NotFoundException("Run not found")
    await this.projectAccess.verifyMember(run.test.projectId, userId)

    return prisma.sharedReport.findUnique({
      where: { runId },
      select: { token: true, createdAt: true, updatedAt: true },
    })
  }

  /** Public frame listing by token — the run's recording for the shared page. */
  async findPublicFrames(token: string): Promise<string[]> {
    const report = await prisma.sharedReport.findUnique({
      where: { token },
      select: { runId: true },
    })
    if (!report) throw new NotFoundException("Report not found")
    return this.artifacts.listFrames(report.runId)
  }

  /**
   * Public lookup by token — no auth. Returns the share metadata plus a
   * sanitized view of the run (no ids, live-view URL, metadata, or step
   * actions, which can embed typed-in values). `run` is null if the run was
   * deleted after sharing.
   */
  async findPublic(token: string) {
    const report = await prisma.sharedReport.findUnique({
      where: { token },
      select: { title: true, createdAt: true, updatedAt: true, runId: true },
    })
    if (!report) throw new NotFoundException("Report not found")

    const run = await prisma.testRun.findUnique({
      where: { id: report.runId },
      select: {
        status: true,
        trigger: true,
        startedAt: true,
        finishedAt: true,
        errorMessage: true,
        totalSteps: true,
        passedSteps: true,
        totalTokens: true,
        inferenceTimeMs: true,
        cacheHits: true,
        browserEnv: true,
        createdAt: true,
        stepResults: {
          orderBy: { stepIndex: "asc" },
          select: {
            id: true,
            stepIndex: true,
            instruction: true,
            description: true,
            result: true,
            cacheStatus: true,
            errorMessage: true,
            durationMs: true,
            screenshotUrl: true,
            createdAt: true,
          },
        },
        test: {
          select: {
            name: true,
            description: true,
            startUrl: true,
            viewportWidth: true,
            viewportHeight: true,
          },
        },
      },
    })

    return {
      title: report.title,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      run,
    }
  }

  /**
   * Public browser logs by token. Network entries are stripped down to the
   * request line, status and timing — headers and bodies can carry cookies,
   * auth tokens and user data, so they never leave the workspace.
   */
  async findPublicEvents(token: string) {
    const report = await prisma.sharedReport.findUnique({
      where: { token },
      select: { runId: true },
    })
    if (!report) throw new NotFoundException("Report not found")

    const events = await this.artifacts.getBrowserEvents(report.runId)
    if (!events) return { network: [], console: [] }

    const network = (events.network as Record<string, unknown>[]).map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      method: e.method,
      url: e.url,
      status: e.status,
      mimeType: e.mimeType,
      duration: e.duration,
    }))
    return { network, console: events.console }
  }
}
