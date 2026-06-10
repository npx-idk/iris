import { Injectable } from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { ImportSuiteDto } from "./dto/import-suite.dto"

/** Bulk export/import of a project's tests as a portable JSON suite. */
@Injectable()
export class SuiteTransferService {
  constructor(private projectAccess: ProjectAccessService) {}

  async exportSuite(projectId: string, userId: string) {
    await this.projectAccess.verifyMember(projectId, userId)

    const tests = await prisma.test.findMany({
      where: { projectId },
      include: {
        steps: { orderBy: { stepIndex: "asc" } },
        prerequisites: { select: { name: true } },
      },
      orderBy: { order: "asc" },
    })

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      tests: tests.map((t) => ({
        name: t.name,
        description: t.description ?? undefined,
        startUrl: t.startUrl ?? undefined,
        tags: t.tags,
        enabled: t.enabled,
        continueOnFailure: t.continueOnFailure,
        prerequisiteNames: t.prerequisites.map((p) => p.name),
        steps: t.steps.map((s) => ({
          stepIndex: s.stepIndex,
          instruction: s.instruction,
          description: s.description ?? undefined,
          ...(s.variables && Object.keys(s.variables as object).length > 0
            ? { variables: s.variables }
            : {}),
        })),
      })),
    }
  }

  async importSuite(projectId: string, userId: string, dto: ImportSuiteDto) {
    await this.projectAccess.verifyMember(projectId, userId, true)

    const maxOrder = await prisma.test.aggregate({
      where: { projectId },
      _max: { order: true },
    })
    let nextOrder = (maxOrder._max.order ?? -1) + 1

    const created: Array<{ id: string; name: string }> = []
    for (const t of dto.tests) {
      const test = await prisma.test.create({
        data: {
          name: t.name,
          description: t.description,
          startUrl: t.startUrl,
          tags: t.tags ?? [],
          enabled: t.enabled ?? true,
          continueOnFailure: t.continueOnFailure ?? false,
          order: nextOrder++,
          projectId,
          steps: {
            create: t.steps.map((s) => ({
              stepIndex: s.stepIndex,
              instruction: s.instruction,
              description: s.description,
              variables: s.variables ?? {},
            })),
          },
        },
      })
      created.push({ id: test.id, name: test.name })
    }

    // Prerequisites are referenced by name in the export format; resolve them
    // against the full project so imports can link to pre-existing tests too.
    const allProjectTests = await prisma.test.findMany({
      where: { projectId },
      select: { id: true, name: true },
    })
    const nameToId = new Map(allProjectTests.map((t) => [t.name, t.id]))

    for (const importedTest of dto.tests) {
      if (!importedTest.prerequisiteNames?.length) continue
      const testId = nameToId.get(importedTest.name)
      if (!testId) continue
      const prereqIds = importedTest.prerequisiteNames
        .map((n) => nameToId.get(n))
        .filter((id): id is string => !!id && id !== testId)
      if (!prereqIds.length) continue
      await prisma.test.update({
        where: { id: testId },
        data: { prerequisites: { connect: prereqIds.map((id) => ({ id })) } },
      })
    }

    return created
  }
}
