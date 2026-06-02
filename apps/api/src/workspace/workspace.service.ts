import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { uniqueSlug } from "../common/utils/slug.util"
import { CreateVariableDto } from "./dto/create-variable.dto"
import { UpdateVariableDto } from "./dto/update-variable.dto"

@Injectable()
export class WorkspaceService {
  // ─── Workspace lookup & provisioning ────────────────────────────────────────

  async findForUser(userId: string) {
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    })
    return membership?.workspace ?? null
  }

  async findOrCreate(userId: string, name: string): Promise<{ id: string }> {
    const existing = await this.findForUser(userId)
    if (existing) return existing

    const slug = await uniqueSlug(
      name,
      async (s) => !!(await prisma.workspace.findUnique({ where: { slug: s } }))
    )

    return prisma.workspace.create({
      data: {
        name,
        slug,
        members: { create: { userId, role: "OWNER" } },
      },
    })
  }

  private async getWorkspace(userId: string) {
    const existing = await this.findForUser(userId)
    if (existing) return existing

    const user = await prisma.user.findUnique({ where: { id: userId } })
    const name = user?.name ? `${user.name}'s workspace` : "My workspace"
    return this.findOrCreate(userId, name)
  }

  private async getMembership(userId: string) {
    const workspace = await this.getWorkspace(userId)
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
    })
    if (!membership) throw new ForbiddenException()
    return { workspace, membership }
  }

  private assertCanManage(role: string) {
    if (role !== "OWNER" && role !== "ADMIN") {
      throw new ForbiddenException("Requires OWNER or ADMIN role")
    }
  }

  // ─── Variables ──────────────────────────────────────────────────────────────

  async listVariables(userId: string) {
    const workspace = await this.getWorkspace(userId)
    const vars = await prisma.workspaceVariable.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
    })
    return vars.map((v) => ({ ...v, value: v.isSecret ? "" : v.value }))
  }

  async createVariable(userId: string, dto: CreateVariableDto) {
    const { workspace, membership } = await this.getMembership(userId)
    this.assertCanManage(membership.role)

    const existing = await prisma.workspaceVariable.findUnique({
      where: {
        workspaceId_name: { workspaceId: workspace.id, name: dto.name },
      },
    })
    if (existing)
      throw new ConflictException(`Variable "${dto.name}" already exists`)

    const variable = await prisma.workspaceVariable.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        value: dto.value,
        isSecret: dto.isSecret ?? false,
      },
    })
    return { ...variable, value: variable.isSecret ? "" : variable.value }
  }

  async updateVariable(userId: string, varId: string, dto: UpdateVariableDto) {
    const { workspace, membership } = await this.getMembership(userId)
    this.assertCanManage(membership.role)

    const variable = await prisma.workspaceVariable.findUnique({
      where: { id: varId },
    })
    if (!variable || variable.workspaceId !== workspace.id)
      throw new NotFoundException("Variable not found")

    if (dto.name && dto.name !== variable.name) {
      const conflict = await prisma.workspaceVariable.findUnique({
        where: {
          workspaceId_name: { workspaceId: workspace.id, name: dto.name },
        },
      })
      if (conflict)
        throw new ConflictException(`Variable "${dto.name}" already exists`)
    }

    const updated = await prisma.workspaceVariable.update({
      where: { id: varId },
      data: { name: dto.name, value: dto.value, isSecret: dto.isSecret },
    })
    return { ...updated, value: updated.isSecret ? "" : updated.value }
  }

  async deleteVariable(userId: string, varId: string) {
    const { workspace, membership } = await this.getMembership(userId)
    this.assertCanManage(membership.role)

    const variable = await prisma.workspaceVariable.findUnique({
      where: { id: varId },
    })
    if (!variable || variable.workspaceId !== workspace.id)
      throw new NotFoundException("Variable not found")
    await prisma.workspaceVariable.delete({ where: { id: varId } })
  }

  async getVariablesMap(workspaceId: string): Promise<Record<string, string>> {
    const vars = await prisma.workspaceVariable.findMany({
      where: { workspaceId },
    })
    return Object.fromEntries(vars.map((v) => [v.name, v.value]))
  }

  // ─── Usage ──────────────────────────────────────────────────────────────────

  async getUsage(userId: string, days: number) {
    const workspace = await this.getWorkspace(userId)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Resolve all project IDs in this workspace
    const projects = await prisma.project.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true },
    })
    const projectIds = projects.map((p) => p.id)

    // Aggregate totals across all runs in the period
    const totals = await prisma.testRun.aggregate({
      where: {
        test: { projectId: { in: projectIds } },
        createdAt: { gte: since },
        finishedAt: { not: null },
      },
      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
        reasoningTokens: true,
        cachedTokens: true,
        cacheHits: true,
        totalSteps: true,
        passedSteps: true,
      },
      _count: { id: true },
    })

    // Per-project breakdown
    const byProjectRaw = await prisma.testRun.groupBy({
      by: ["testId"],
      where: {
        test: { projectId: { in: projectIds } },
        createdAt: { gte: since },
        finishedAt: { not: null },
      },
      _sum: { totalTokens: true, cacheHits: true },
      _count: { id: true },
    })

    // Map testId → projectId via test lookup
    const testToProject = await prisma.test.findMany({
      where: { id: { in: byProjectRaw.map((r) => r.testId) } },
      select: { id: true, projectId: true },
    })
    const testProjectMap = new Map(
      testToProject.map((t) => [t.id, t.projectId])
    )

    const byProjectMap = new Map<
      string,
      { runs: number; tokens: number; cacheHits: number }
    >()
    for (const row of byProjectRaw) {
      const pid = testProjectMap.get(row.testId) ?? "unknown"
      const existing = byProjectMap.get(pid) ?? {
        runs: 0,
        tokens: 0,
        cacheHits: 0,
      }
      byProjectMap.set(pid, {
        runs: existing.runs + row._count.id,
        tokens: existing.tokens + (row._sum.totalTokens ?? 0),
        cacheHits: existing.cacheHits + (row._sum.cacheHits ?? 0),
      })
    }

    const byProject = projects
      .map((p) => ({
        projectId: p.id,
        projectName: p.name,
        ...(byProjectMap.get(p.id) ?? { runs: 0, tokens: 0, cacheHits: 0 }),
      }))
      .filter((p) => p.runs > 0)
      .sort((a, b) => b.tokens - a.tokens)

    // Top tests by token usage
    const topTests = await prisma.testRun.groupBy({
      by: ["testId"],
      where: {
        test: { projectId: { in: projectIds } },
        createdAt: { gte: since },
        finishedAt: { not: null },
      },
      _sum: { totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: "desc" } },
      take: 10,
    })

    const topTestDetails = await prisma.test.findMany({
      where: { id: { in: topTests.map((t) => t.testId) } },
      select: { id: true, name: true, projectId: true },
    })
    const testDetailMap = new Map(topTestDetails.map((t) => [t.id, t]))
    const projectNameMap = new Map(projects.map((p) => [p.id, p.name]))

    const topTestsResult = topTests.map((row) => {
      const test = testDetailMap.get(row.testId)
      return {
        testId: row.testId,
        testName: test?.name ?? "Unknown",
        projectName: projectNameMap.get(test?.projectId ?? "") ?? "",
        runs: row._count.id,
        totalTokens: row._sum.totalTokens ?? 0,
        avgTokens:
          row._count.id > 0
            ? Math.round((row._sum.totalTokens ?? 0) / row._count.id)
            : 0,
      }
    })

    // Daily breakdown using raw SQL for date truncation
    type DailyRow = { date: Date; tokens: string | null; runs: string | null }
    const dailyRows = await prisma.$queryRaw<DailyRow[]>`
      SELECT
        DATE_TRUNC('day', r."createdAt") AS date,
        SUM(r."totalTokens")::text AS tokens,
        COUNT(r.id)::text AS runs
      FROM test_runs r
      JOIN tests t ON t.id = r."testId"
      WHERE t."projectId" = ANY(${projectIds}::text[])
        AND r."createdAt" >= ${since}
        AND r."finishedAt" IS NOT NULL
      GROUP BY DATE_TRUNC('day', r."createdAt")
      ORDER BY date ASC
    `

    const daily = dailyRows.map((row) => ({
      date: (row.date as Date).toISOString().split("T")[0],
      tokens: Number(row.tokens ?? 0),
      runs: Number(row.runs ?? 0),
    }))

    // Total steps and cache rate for the period
    const totalRuns = totals._count.id
    const totalSteps = totals._sum.totalSteps ?? 0
    const totalCacheHits = totals._sum.cacheHits ?? 0
    const cacheHitRate = totalSteps > 0 ? totalCacheHits / totalSteps : 0

    return {
      period: { days, since: since.toISOString() },
      totals: {
        totalTokens: totals._sum.totalTokens ?? 0,
        promptTokens: totals._sum.promptTokens ?? 0,
        completionTokens: totals._sum.completionTokens ?? 0,
        reasoningTokens: totals._sum.reasoningTokens ?? 0,
        cachedTokens: totals._sum.cachedTokens ?? 0,
        runs: totalRuns,
        totalSteps,
        cacheHits: totalCacheHits,
        cacheHitRate,
      },
      daily,
      byProject,
      topTests: topTestsResult,
    }
  }
}
