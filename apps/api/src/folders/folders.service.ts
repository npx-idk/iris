import { Injectable, NotFoundException } from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { CreateFolderDto } from "./dto/create-folder.dto"
import { UpdateFolderDto } from "./dto/update-folder.dto"

@Injectable()
export class FoldersService {
  constructor(private projectAccess: ProjectAccessService) {}

  private async getFolderAndVerify(
    folderId: string,
    userId: string,
    write = false
  ) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } })
    if (!folder) throw new NotFoundException("Folder not found")
    await this.projectAccess.verifyMember(folder.projectId, userId, write)
    return folder
  }

  async findAll(projectId: string, userId: string) {
    await this.projectAccess.verifyMember(projectId, userId)
    return prisma.folder.findMany({
      where: { projectId },
      orderBy: [{ parentId: "asc" }, { order: "asc" }, { name: "asc" }],
    })
  }

  async create(projectId: string, userId: string, dto: CreateFolderDto) {
    await this.projectAccess.verifyMember(projectId, userId, true)
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
    await prisma.folder.delete({ where: { id: folderId } })
  }
}
