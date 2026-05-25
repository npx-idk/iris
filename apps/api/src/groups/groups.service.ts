import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { prisma } from '../prisma/prisma'
import { CreateGroupDto } from './dto/create-group.dto'
import { UpdateGroupDto } from './dto/update-group.dto'

@Injectable()
export class GroupsService {
  private async verifyProjectAccess(projectId: string, userId: string, write = false) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!member) throw new ForbiddenException('Not a project member')
    if (write && member.role === 'VIEWER') {
      throw new ForbiddenException('Viewers cannot modify groups')
    }
    return member
  }

  private async getGroupAndVerify(groupId: string, userId: string, write = false) {
    const group = await prisma.testGroup.findUnique({ where: { id: groupId } })
    if (!group) throw new NotFoundException('Group not found')
    await this.verifyProjectAccess(group.projectId, userId, write)
    return group
  }

  async findAll(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId)
    return prisma.testGroup.findMany({
      where: { projectId },
      include: { _count: { select: { tests: true } } },
      orderBy: { order: 'asc' },
    })
  }

  async create(projectId: string, userId: string, dto: CreateGroupDto) {
    await this.verifyProjectAccess(projectId, userId, true)
    const maxOrder = await prisma.testGroup.aggregate({
      where: { projectId },
      _max: { order: true },
    })
    const order = (maxOrder._max.order ?? -1) + 1
    return prisma.testGroup.create({
      data: { name: dto.name, order, projectId },
      include: { _count: { select: { tests: true } } },
    })
  }

  async update(groupId: string, userId: string, dto: UpdateGroupDto) {
    await this.getGroupAndVerify(groupId, userId, true)
    return prisma.testGroup.update({
      where: { id: groupId },
      data: dto,
      include: { _count: { select: { tests: true } } },
    })
  }

  async remove(groupId: string, userId: string) {
    await this.getGroupAndVerify(groupId, userId, true)
    // Tests with this groupId are unlinked automatically via onDelete: SetNull
    await prisma.testGroup.delete({ where: { id: groupId } })
  }
}
