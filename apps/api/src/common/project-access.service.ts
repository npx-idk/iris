import { Injectable, ForbiddenException } from "@nestjs/common"
import { prisma } from "../prisma/prisma"

@Injectable()
export class ProjectAccessService {
  async verifyMember(projectId: string, userId: string, write = false) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!member) throw new ForbiddenException("Not a project member")
    if (write && member.role === "VIEWER")
      throw new ForbiddenException("Insufficient permissions")
    return member
  }
}
