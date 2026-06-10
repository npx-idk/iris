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

  private async requireManager(userId: string) {
    const ctx = await this.getMembership(userId)
    if (ctx.membership.role !== "OWNER" && ctx.membership.role !== "ADMIN") {
      throw new ForbiddenException("Requires OWNER or ADMIN role")
    }
    return ctx
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
    const { workspace } = await this.requireManager(userId)

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
    const { workspace } = await this.requireManager(userId)

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
    const { workspace } = await this.requireManager(userId)

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
}
