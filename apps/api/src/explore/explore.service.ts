import { Injectable, ForbiddenException } from '@nestjs/common'
import { explorePage } from '@iris/agent'
import { prisma } from '../prisma/prisma'
import { ExploreDto } from './dto/explore.dto'

@Injectable()
export class ExploreService {
  async explore(projectId: string, userId: string, dto: ExploreDto) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!member) throw new ForbiddenException('Not a project member')

    // Resolve prerequisite test steps (for authenticated page exploration)
    let prerequisite: { startUrl?: string; steps: Array<{ instruction: string }> } | undefined
    if (dto.prerequisiteTestId) {
      const prereqTest = await prisma.test.findFirst({
        where: { id: dto.prerequisiteTestId, projectId },
        include: { steps: { orderBy: { stepIndex: 'asc' } } },
      })
      if (prereqTest) {
        prerequisite = {
          startUrl: prereqTest.startUrl ?? undefined,
          steps: prereqTest.steps.map((s) => ({ instruction: s.instruction })),
        }
      }
    }

    // Fetch workspace variables for interpolating {{tokens}} in prereq steps
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      include: {
        workspace: {
          include: { variables: true },
        },
      },
    })
    const variables: Record<string, string> = {}
    for (const v of workspaceMember?.workspace.variables ?? []) {
      variables[v.name] = v.value
    }

    return explorePage({
      url: dto.url,
      context: dto.context,
      prerequisite,
      variables,
      env: (process.env.BROWSER_ENV ?? 'LOCAL') as 'LOCAL' | 'BROWSERBASE',
      geminiApiKey: process.env.GEMINI_API_KEY ?? '',
      browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
      browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
    })
  }
}
