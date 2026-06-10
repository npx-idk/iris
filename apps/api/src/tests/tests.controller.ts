import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from "@nestjs/common"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser, RequestUser } from "../auth/current-user.decorator"
import { TestsService } from "./tests.service"
import { PrerequisitesService } from "./prerequisites.service"
import { SuiteTransferService } from "./suite-transfer.service"
import { CreateTestDto } from "./dto/create-test.dto"
import { UpdateTestDto } from "./dto/update-test.dto"
import { UpsertStepsDto } from "./dto/upsert-steps.dto"
import { ReorderTestsDto } from "./dto/reorder-tests.dto"
import { AddPrerequisiteDto } from "./dto/add-prerequisite.dto"
import { ImportSuiteDto } from "./dto/import-suite.dto"

@UseGuards(AuthGuard)
@Controller()
export class TestsController {
  constructor(
    private readonly tests: TestsService,
    private readonly prerequisites: PrerequisitesService,
    private readonly suiteTransfer: SuiteTransferService
  ) {}

  @Get("tests")
  findAllForUser(@CurrentUser() user: RequestUser) {
    return this.tests.findAllForUser(user.id)
  }

  @Get("projects/:projectId/tests")
  findAll(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string
  ) {
    return this.tests.findAll(projectId, user.id)
  }

  @Post("projects/:projectId/tests")
  create(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Body() dto: CreateTestDto
  ) {
    return this.tests.create(projectId, user.id, dto)
  }

  @Get("tests/:id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tests.findOne(id, user.id)
  }

  @Patch("tests/:id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateTestDto
  ) {
    return this.tests.update(id, user.id, dto)
  }

  @Delete("tests/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tests.remove(id, user.id)
  }

  @Post("tests/:id/duplicate")
  duplicate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tests.duplicate(id, user.id)
  }

  @Patch("projects/:projectId/tests/reorder")
  reorder(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Body() dto: ReorderTestsDto
  ) {
    return this.tests.reorder(projectId, user.id, dto)
  }

  @Post("tests/:id/prerequisites")
  addPrerequisite(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: AddPrerequisiteDto
  ) {
    return this.prerequisites.add(id, user.id, dto)
  }

  @Delete("tests/:id/prerequisites/:prerequisiteId")
  @HttpCode(204)
  removePrerequisite(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("prerequisiteId") prerequisiteId: string
  ) {
    return this.prerequisites.remove(id, user.id, prerequisiteId)
  }

  @Get("projects/:projectId/export")
  exportSuite(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string
  ) {
    return this.suiteTransfer.exportSuite(projectId, user.id)
  }

  @Post("projects/:projectId/import")
  importSuite(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Body() dto: ImportSuiteDto
  ) {
    return this.suiteTransfer.importSuite(projectId, user.id, dto)
  }

  @Put("tests/:id/steps")
  upsertSteps(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpsertStepsDto
  ) {
    return this.tests.upsertSteps(id, user.id, dto)
  }
}
