import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common'
import { prisma } from '../prisma/prisma'
import { CreateTestDto } from './dto/create-test.dto'
import { UpdateTestDto } from './dto/update-test.dto'
import { UpsertStepsDto } from './dto/upsert-steps.dto'
import { ReorderTestsDto } from './dto/reorder-tests.dto'
import { AddPrerequisiteDto } from './dto/add-prerequisite.dto'
import { ImportSuiteDto } from './dto/import-suite.dto'
import { wouldCreateCycle } from './prerequisite.util'

@Injectable()
export class TestsService {

  private async verifyProjectAccess(projectId: string, userId: string, write = false) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!member) throw new ForbiddenException('Not a project member')
    if (write && member.role === 'VIEWER') {
      throw new ForbiddenException('Viewers cannot modify tests')
    }
    return member
  }

  private async getTestAndVerify(testId: string, userId: string, write = false) {
    const test = await prisma.test.findUnique({ where: { id: testId } })
    if (!test) throw new NotFoundException('Test not found')
    await this.verifyProjectAccess(test.projectId, userId, write)
    return test
  }

  async findAll(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId)

    return prisma.test.findMany({
      where: { projectId },
      include: {
        _count: { select: { steps: true, runs: true } },
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
        prerequisites: {
          select: { id: true, name: true },
        },
        group: { select: { id: true, name: true } },
      },
      orderBy: { order: 'asc' },
    })
  }

  async findOne(testId: string, userId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        prerequisites: {
          include: { steps: { orderBy: { stepIndex: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        prerequisiteOf: { select: { id: true, name: true } },
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, status: true, totalSteps: true,
            passedSteps: true, createdAt: true, finishedAt: true,
          },
        },
        _count: { select: { runs: true } },
      },
    })

    if (!test) throw new NotFoundException('Test not found')
    await this.verifyProjectAccess(test.projectId, userId)
    return test
  }

  async create(projectId: string, userId: string, dto: CreateTestDto) {
    await this.verifyProjectAccess(projectId, userId, true)

    const maxOrder = await prisma.test.aggregate({
      where: { projectId },
      _max: { order: true },
    })
    const order = (maxOrder._max.order ?? -1) + 1

    return prisma.test.create({
      data: {
        name: dto.name,
        description: dto.description,
        startUrl: dto.startUrl,
        tags: dto.tags ?? [],
        enabled: dto.enabled ?? true,
        order,
        projectId,
      },
    })
  }

  async update(testId: string, userId: string, dto: UpdateTestDto) {
    await this.getTestAndVerify(testId, userId, true)
    return prisma.test.update({ where: { id: testId }, data: dto })
  }

  async remove(testId: string, userId: string) {
    await this.getTestAndVerify(testId, userId, true)

    const dependents = await prisma.test.findMany({
      where: { prerequisites: { some: { id: testId } } },
      select: { id: true, name: true },
    })

    if (dependents.length > 0) {
      const names = dependents.map((d) => `"${d.name}"`).join(', ')
      throw new ConflictException(
        `Cannot delete — this test is a prerequisite for: ${names}. ` +
        `Remove those dependencies first.`
      )
    }

    await prisma.test.delete({ where: { id: testId } })
  }

  async duplicate(testId: string, userId: string) {
    const test = await this.findOne(testId, userId)
    await this.verifyProjectAccess(test.projectId, userId, true)

    const maxOrder = await prisma.test.aggregate({
      where: { projectId: test.projectId },
      _max: { order: true },
    })

    return prisma.test.create({
      data: {
        name: `${test.name} (copy)`,
        description: test.description,
        startUrl: test.startUrl,
        tags: test.tags,
        enabled: false,
        order: (maxOrder._max.order ?? 0) + 1,
        projectId: test.projectId,
        steps: {
          create: test.steps.map((s) => ({
            stepIndex: s.stepIndex,
            instruction: s.instruction,
            description: s.description,
            variables: s.variables ?? {},
          })),
        },
      },
      include: { steps: { orderBy: { stepIndex: 'asc' } } },
    })
  }

  async reorder(projectId: string, userId: string, dto: ReorderTestsDto) {
    await this.verifyProjectAccess(projectId, userId, true)

    const testIds = dto.tests.map((t) => t.id)
    const tests = await prisma.test.findMany({
      where: { id: { in: testIds }, projectId },
      select: { id: true },
    })

    if (tests.length !== testIds.length) {
      throw new BadRequestException('One or more tests do not belong to this project')
    }

    await prisma.$transaction(
      dto.tests.map(({ id, order }) =>
        prisma.test.update({ where: { id }, data: { order } })
      )
    )

    return this.findAll(projectId, userId)
  }

  async addPrerequisite(testId: string, userId: string, dto: AddPrerequisiteDto) {
    const test = await this.getTestAndVerify(testId, userId, true)
    const { prerequisiteId } = dto

    if (testId === prerequisiteId) {
      throw new BadRequestException('A test cannot be its own prerequisite')
    }

    const prereq = await prisma.test.findUnique({
      where: { id: prerequisiteId },
    })
    if (!prereq) throw new NotFoundException('Prerequisite test not found')
    if (prereq.projectId !== test.projectId) {
      throw new BadRequestException('Prerequisites must belong to the same project')
    }

    const existing = await prisma.test.findFirst({
      where: {
        id: testId,
        prerequisites: { some: { id: prerequisiteId } },
      },
    })
    if (existing) {
      throw new ConflictException('This prerequisite is already added')
    }

    const hasCycle = await wouldCreateCycle(
      testId,
      prerequisiteId,
      async (id) => {
        const t = await prisma.test.findUnique({
          where: { id },
          select: { prerequisites: { select: { id: true } } },
        })
        return t?.prerequisites.map((p) => p.id) ?? []
      },
    )

    if (hasCycle) {
      throw new BadRequestException(
        'Cannot add this prerequisite — it would create a circular dependency'
      )
    }

    await prisma.test.update({
      where: { id: testId },
      data: { prerequisites: { connect: { id: prerequisiteId } } },
    })

    return this.findOne(testId, userId)
  }

  async removePrerequisite(testId: string, userId: string, prerequisiteId: string) {
    await this.getTestAndVerify(testId, userId, true)

    await prisma.test.update({
      where: { id: testId },
      data: { prerequisites: { disconnect: { id: prerequisiteId } } },
    })
  }

  async exportSuite(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId)

    const tests = await prisma.test.findMany({
      where: { projectId },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        prerequisites: { select: { name: true } },
      },
      orderBy: { order: 'asc' },
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
    await this.verifyProjectAccess(projectId, userId, true)

    const maxOrder = await prisma.test.aggregate({
      where: { projectId },
      _max: { order: true },
    })
    let nextOrder = (maxOrder._max.order ?? -1) + 1

    // Create all tests first (without prerequisites)
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

    // Wire up prerequisites by name match within this project
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

  async upsertSteps(testId: string, userId: string, dto: UpsertStepsDto) {
    await this.getTestAndVerify(testId, userId, true)

    await prisma.$transaction([
      prisma.testStep.deleteMany({ where: { testId } }),
      prisma.testStep.createMany({
        data: dto.steps.map((s) => ({
          testId,
          stepIndex: s.stepIndex,
          instruction: s.instruction,
          description: s.description,
          variables: s.variables ?? {},
        })),
      }),
    ])

    return prisma.testStep.findMany({
      where: { testId },
      orderBy: { stepIndex: 'asc' },
    })
  }
}
