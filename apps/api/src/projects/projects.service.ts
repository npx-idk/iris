import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { CreateProjectDto } from "./dto/create-project.dto"
import { UpdateProjectDto } from "./dto/update-project.dto"
import { uniqueSlug } from "../common/utils/slug.util"
import { WorkspaceService } from "../workspace/workspace.service"

@Injectable()
export class ProjectsService {
  constructor(private readonly workspaceService: WorkspaceService) {}

  async findAllForUser(userId: string) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return memberships.map((m) => ({
      ...m.project,
      role: m.role,
      memberCount: m.project._count.members,
    }))
  }

  async findOne(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { members: true } },
      },
    })

    if (!project) throw new NotFoundException("Project not found")

    const member = project.members.find((m) => m.userId === userId)
    if (!member) throw new ForbiddenException("Not a project member")

    return { ...project, role: member.role }
  }

  async create(userId: string, dto: CreateProjectDto) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })
    const workspace = await this.workspaceService.findOrCreate(
      userId,
      user?.name ? `${user.name}'s workspace` : "My workspace"
    )

    const slug = await uniqueSlug(
      dto.slug ?? dto.name,
      async (s) => !!(await prisma.project.findUnique({ where: { slug: s } }))
    )

    return prisma.project.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        baseUrl: dto.baseUrl,
        workspaceId: workspace.id,
        members: {
          create: { userId, role: "OWNER" },
        },
      },
    })
  }

  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async update(projectId: string, dto: UpdateProjectDto) {
    return prisma.project.update({
      where: { id: projectId },
      data: dto,
    })
  }

  // Role already verified by @ProjectRoles('OWNER') guard
  async remove(projectId: string) {
    await prisma.project.delete({ where: { id: projectId } })
  }
}
