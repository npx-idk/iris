import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { prisma } from '../prisma/prisma'
import { CreateFolderDto } from './dto/create-folder.dto'
import { UpdateFolderDto } from './dto/update-folder.dto'

@Injectable()
export class FoldersService {
  private async verifyProjectAccess(projectId: string, userId: string, write = false) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!member) throw new ForbiddenException('Not a project member')
    if (write && member.role === 'VIEWER') throw new ForbiddenException('Viewers cannot modify folders')
    return member
  }

  private async getFolderAndVerify(folderId: string, userId: string, write = false) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } })
    if (!folder) throw new NotFoundException('Folder not found')
    await this.verifyProjectAccess(folder.projectId, userId, write)
    return folder
  }

  async findAll(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId)
    return prisma.folder.findMany({
      where: { projectId },
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    })
  }

  async create(projectId: string, userId: string, dto: CreateFolderDto) {
    await this.verifyProjectAccess(projectId, userId, true)
    const maxOrder = await prisma.folder.aggregate({
      where: { projectId, parentId: dto.parentId ?? null },
      _max: { order: true },
    })
    return prisma.folder.create({
      data: {
        name: dto.name,
        projectId,
        parentId: dto.parentId ?? null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    })
  }

  async update(folderId: string, userId: string, dto: UpdateFolderDto) {
    await this.getFolderAndVerify(folderId, userId, true)
    return prisma.folder.update({
      where: { id: folderId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
    })
  }

  async remove(folderId: string, userId: string) {
    await this.getFolderAndVerify(folderId, userId, true)
    // Children cascade via DB, tests get folderId=null via SetNull
    await prisma.folder.delete({ where: { id: folderId } })
  }
}
