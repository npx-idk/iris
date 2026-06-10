import { Injectable, NotFoundException } from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { generateApiKey } from "../common/utils/api-key.util"
import { CreateApiKeyDto } from "./dto/create-api-key.dto"

/** Project-scoped API keys used by the CLI / CI integrations. */
@Injectable()
export class ApiKeysService {
  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async list(projectId: string) {
    return prisma.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        role: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async create(projectId: string, userId: string, dto: CreateApiKeyDto) {
    const { raw, hash, prefix } = generateApiKey()

    const apiKey = await prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash: hash,
        keyPrefix: prefix,
        role: dto.role,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        userId,
        projectId,
      },
    })

    // Return raw key ONCE — never stored, never retrievable again
    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      role: apiKey.role,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      raw,
    }
  }

  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async revoke(projectId: string, keyId: string) {
    const key = await prisma.apiKey.findUnique({ where: { id: keyId } })
    if (!key || key.projectId !== projectId) {
      throw new NotFoundException("API key not found")
    }

    await prisma.apiKey.delete({ where: { id: keyId } })
  }
}
