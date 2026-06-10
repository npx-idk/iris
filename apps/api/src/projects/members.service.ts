import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common"
import { can, type ProjectRole } from "@iris/common"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { InviteMemberDto } from "./dto/invite-member.dto"
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto"

@Injectable()
export class MembersService {
  constructor(private readonly projectAccess: ProjectAccessService) {}

  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async invite(projectId: string, dto: InviteMemberDto) {
    const invitee = await prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (!invitee) {
      // Generic message — do not reveal whether the email is registered
      throw new BadRequestException("Could not invite that email address.")
    }

    const existing = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: invitee.id, projectId } },
    })
    if (existing) throw new ConflictException("User is already a member")

    return prisma.projectMember.create({
      data: { projectId, userId: invitee.id, role: dto.role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })
  }

  // Role already verified by @ProjectRoles('OWNER') guard
  async updateRole(
    projectId: string,
    userId: string,
    memberId: string,
    dto: UpdateMemberRoleDto
  ) {
    return prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.findUnique({
        where: { id: memberId },
      })
      if (!member || member.projectId !== projectId) {
        throw new NotFoundException("Member not found")
      }
      if (member.userId === userId) {
        throw new BadRequestException("Cannot change your own role")
      }

      if (member.role === "OWNER") {
        const ownerCount = await tx.projectMember.count({
          where: { projectId, role: "OWNER" },
        })
        if (ownerCount <= 1) {
          throw new BadRequestException("Cannot demote the last owner")
        }
      }

      return tx.projectMember.update({
        where: { id: memberId },
        data: { role: dto.role },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      })
    })
  }

  // Self-removal + OWNER/ADMIN logic is too nuanced for a single decorator,
  // so membership and permission checks live here.
  async remove(projectId: string, userId: string, memberId: string) {
    const actorMember = await this.projectAccess.verifyMember(projectId, userId)

    await prisma.$transaction(async (tx) => {
      const targetMember = await tx.projectMember.findUnique({
        where: { id: memberId },
      })

      if (!targetMember || targetMember.projectId !== projectId) {
        throw new NotFoundException("Member not found")
      }

      const isSelf = targetMember.userId === userId
      const canRemoveOthers = can(actorMember.role as ProjectRole, "manage")

      if (!isSelf && !canRemoveOthers) {
        throw new ForbiddenException()
      }

      if (targetMember.role === "OWNER") {
        const ownerCount = await tx.projectMember.count({
          where: { projectId, role: "OWNER" },
        })
        if (ownerCount <= 1) {
          throw new BadRequestException("Cannot remove the last owner")
        }
      }

      await tx.projectMember.delete({ where: { id: memberId } })
    })
  }
}
