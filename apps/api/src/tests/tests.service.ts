import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { CreateTestDto } from "./dto/create-test.dto"
import { UpdateTestDto } from "./dto/update-test.dto"
import { UpsertStepsDto } from "./dto/upsert-steps.dto"
import { ReorderTestsDto } from "./dto/reorder-tests.dto"

@Injectable()
export class TestsService {
  constructor(private projectAccess: ProjectAccessService) {}

  private async getTestAndVerify(
    testId: string,
    userId: string,
    write = false
  ) {
    const test = await prisma.test.findUnique({ where: { id: testId } })
    if (!test) throw new NotFoundException("Test not found")
    await this.projectAccess.verifyMember(test.projectId, userId, write)
    return test
  }

  async findAllForUser(userId: string) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    })
    const projectIds = memberships.map((m) => m.projectId)

    return prisma.test.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        _count: { select: { steps: true, runs: true } },
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
        folder: { select: { id: true, name: true, parentId: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ projectId: "asc" }, { order: "asc" }],
    })
  }

  async findAll(projectId: string, userId: string) {
    await this.projectAccess.verifyMember(projectId, userId)

    return prisma.test.findMany({
      where: { projectId },
      include: {
        _count: { select: { steps: true, runs: true } },
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
        prerequisites: {
          select: { id: true, name: true },
        },
        folder: { select: { id: true, name: true, parentId: true } },
      },
      orderBy: { order: "asc" },
    })
  }

  async findOne(testId: string, userId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        steps: { orderBy: { stepIndex: "asc" } },
        prerequisites: {
          include: { steps: { orderBy: { stepIndex: "asc" } } },
          orderBy: { order: "asc" },
        },
        prerequisiteOf: { select: { id: true, name: true } },
        runs: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            totalSteps: true,
            passedSteps: true,
            createdAt: true,
            finishedAt: true,
          },
        },
        _count: { select: { runs: true } },
      },
    })

    if (!test) throw new NotFoundException("Test not found")
    await this.projectAccess.verifyMember(test.projectId, userId)
    return test
  }

  async create(projectId: string, userId: string, dto: CreateTestDto) {
    await this.projectAccess.verifyMember(projectId, userId, true)

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
    const test = await this.getTestAndVerify(testId, userId, true)

    if (dto.folderId != null) {
      const folder = await prisma.folder.findUnique({
        where: { id: dto.folderId },
      })
      if (!folder) throw new NotFoundException("Folder not found")
      if (folder.projectId !== test.projectId) {
        throw new BadRequestException("Folder does not belong to this project")
      }
    }

    return prisma.test.update({ where: { id: testId }, data: dto })
  }

  async remove(testId: string, userId: string) {
    await this.getTestAndVerify(testId, userId, true)

    const dependents = await prisma.test.findMany({
      where: { prerequisites: { some: { id: testId } } },
      select: { id: true, name: true },
    })

    if (dependents.length > 0) {
      const names = dependents.map((d) => `"${d.name}"`).join(", ")
      throw new ConflictException(
        `Cannot delete — this test is a prerequisite for: ${names}. ` +
          `Remove those dependencies first.`
      )
    }

    await prisma.test.delete({ where: { id: testId } })
  }

  async duplicate(testId: string, userId: string) {
    const test = await this.findOne(testId, userId)
    await this.projectAccess.verifyMember(test.projectId, userId, true)

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
      include: { steps: { orderBy: { stepIndex: "asc" } } },
    })
  }

  async reorder(projectId: string, userId: string, dto: ReorderTestsDto) {
    await this.projectAccess.verifyMember(projectId, userId, true)

    const testIds = dto.tests.map((t) => t.id)
    const tests = await prisma.test.findMany({
      where: { id: { in: testIds }, projectId },
      select: { id: true },
    })

    if (tests.length !== testIds.length) {
      throw new BadRequestException(
        "One or more tests do not belong to this project"
      )
    }

    await prisma.$transaction(
      dto.tests.map(({ id, order }) =>
        prisma.test.update({ where: { id }, data: { order } })
      )
    )

    return this.findAll(projectId, userId)
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
      orderBy: { stepIndex: "asc" },
    })
  }
}
