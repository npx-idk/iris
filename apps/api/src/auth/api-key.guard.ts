import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { hashApiKey } from "../common/utils/api-key.util"

// Guards routes that accept CI/CD API key auth.
// Expects: Authorization: Bearer iris_<secret>
// The key must belong to the project in the :projectId route param.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name)

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()

    const raw: string | undefined = req.headers["authorization"]?.replace(
      /^Bearer\s+/i,
      ""
    )
    if (!raw?.startsWith("iris_"))
      throw new UnauthorizedException("API key required")

    const hash = hashApiKey(raw)
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: hash },
      include: { user: true },
    })

    if (!apiKey) throw new UnauthorizedException("Invalid API key")
    if (apiKey.expiresAt && apiKey.expiresAt < new Date())
      throw new UnauthorizedException("API key expired")

    // For project-scoped routes validate directly; for test-scoped routes the
    // service layer will verify project membership, so we skip the param check.
    const projectId: string | undefined = req.params?.projectId
    if (projectId && apiKey.projectId !== projectId)
      throw new ForbiddenException("API key does not belong to this project")

    req.user = apiKey.user
    req.apiKeyProjectId = apiKey.projectId

    // Fire-and-forget lastUsedAt update — don't delay the request
    prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch((err) =>
        this.logger.warn(
          `Failed to update lastUsedAt for API key ${apiKey.id}: ${err}`
        )
      )

    return true
  }
}
