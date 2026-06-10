import { Injectable } from "@nestjs/common"
import { explorePage } from "@iris/agent"
import { env } from "../config/env"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { WorkspaceService } from "../workspace/workspace.service"
import { ExploreDto } from "./dto/explore.dto"

@Injectable()
export class ExploreService {
  constructor(
    private projectAccess: ProjectAccessService,
    private workspace: WorkspaceService
  ) {}

  async explore(projectId: string, userId: string, dto: ExploreDto) {
    await this.projectAccess.verifyMember(projectId, userId)

    let prerequisite:
      | { startUrl?: string; steps: Array<{ instruction: string }> }
      | undefined
    if (dto.prerequisiteTestId) {
      const prereqTest = await prisma.test.findFirst({
        where: { id: dto.prerequisiteTestId, projectId },
        include: { steps: { orderBy: { stepIndex: "asc" } } },
      })
      if (prereqTest) {
        prerequisite = {
          startUrl: prereqTest.startUrl ?? undefined,
          steps: prereqTest.steps.map((s) => ({ instruction: s.instruction })),
        }
      }
    }

    let variables: Record<string, string> = {}
    if (prerequisite) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true },
      })
      if (project)
        variables = await this.workspace.getVariablesMap(project.workspaceId)
    }

    return explorePage({
      url: dto.url,
      context: dto.context,
      prerequisite,
      variables,
      ...env.stagehand,
    })
  }
}
