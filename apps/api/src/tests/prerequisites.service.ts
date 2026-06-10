import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { AddPrerequisiteDto } from "./dto/add-prerequisite.dto"
import { wouldCreateCycle } from "./prerequisite.util"
import { TestsService } from "./tests.service"

@Injectable()
export class PrerequisitesService {
  constructor(
    private projectAccess: ProjectAccessService,
    private tests: TestsService
  ) {}

  async add(testId: string, userId: string, dto: AddPrerequisiteDto) {
    const test = await prisma.test.findUnique({ where: { id: testId } })
    if (!test) throw new NotFoundException("Test not found")
    await this.projectAccess.verifyMember(test.projectId, userId, true)

    const { prerequisiteId } = dto

    if (testId === prerequisiteId) {
      throw new BadRequestException("A test cannot be its own prerequisite")
    }

    const prereq = await prisma.test.findUnique({
      where: { id: prerequisiteId },
    })
    if (!prereq) throw new NotFoundException("Prerequisite test not found")
    if (prereq.projectId !== test.projectId) {
      throw new BadRequestException(
        "Prerequisites must belong to the same project"
      )
    }

    const existing = await prisma.test.findFirst({
      where: {
        id: testId,
        prerequisites: { some: { id: prerequisiteId } },
      },
    })
    if (existing) {
      throw new ConflictException("This prerequisite is already added")
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
      }
    )

    if (hasCycle) {
      throw new BadRequestException(
        "Cannot add this prerequisite — it would create a circular dependency"
      )
    }

    await prisma.test.update({
      where: { id: testId },
      data: { prerequisites: { connect: { id: prerequisiteId } } },
    })

    return this.tests.findOne(testId, userId)
  }

  async remove(testId: string, userId: string, prerequisiteId: string) {
    const test = await prisma.test.findUnique({ where: { id: testId } })
    if (!test) throw new NotFoundException("Test not found")
    await this.projectAccess.verifyMember(test.projectId, userId, true)

    await prisma.test.update({
      where: { id: testId },
      data: { prerequisites: { disconnect: { id: prerequisiteId } } },
    })
  }
}
