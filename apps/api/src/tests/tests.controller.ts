import {
  Controller, Get, Post, Patch, Delete, Put,
  Param, Body, UseGuards, HttpCode,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { TestsService } from './tests.service'
import { CreateTestDto } from './dto/create-test.dto'
import { UpdateTestDto } from './dto/update-test.dto'
import { UpsertStepsDto } from './dto/upsert-steps.dto'
import { ReorderTestsDto } from './dto/reorder-tests.dto'
import { AddPrerequisiteDto } from './dto/add-prerequisite.dto'
import { ImportSuiteDto } from './dto/import-suite.dto'

@UseGuards(AuthGuard)
@Controller()
export class TestsController {
  constructor(private readonly tests: TestsService) {}

  @Get('projects/:projectId/tests')
  findAll(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    return this.tests.findAll(projectId, user.id)
  }

  @Post('projects/:projectId/tests')
  create(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestDto,
  ) {
    return this.tests.create(projectId, user.id, dto)
  }

  @Get('tests/:id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tests.findOne(id, user.id)
  }

  @Patch('tests/:id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateTestDto,
  ) {
    return this.tests.update(id, user.id, dto)
  }

  @Delete('tests/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tests.remove(id, user.id)
  }

  @Post('tests/:id/duplicate')
  duplicate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tests.duplicate(id, user.id)
  }

  @Patch('projects/:projectId/tests/reorder')
  reorder(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: ReorderTestsDto,
  ) {
    return this.tests.reorder(projectId, user.id, dto)
  }

  @Post('tests/:id/prerequisites')
  addPrerequisite(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AddPrerequisiteDto,
  ) {
    return this.tests.addPrerequisite(id, user.id, dto)
  }

  @Delete('tests/:id/prerequisites/:prerequisiteId')
  @HttpCode(204)
  removePrerequisite(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('prerequisiteId') prerequisiteId: string,
  ) {
    return this.tests.removePrerequisite(id, user.id, prerequisiteId)
  }

  @Get('projects/:projectId/export')
  exportSuite(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    return this.tests.exportSuite(projectId, user.id)
  }

  @Post('projects/:projectId/import')
  importSuite(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: ImportSuiteDto,
  ) {
    return this.tests.importSuite(projectId, user.id, dto)
  }

  @Put('tests/:id/steps')
  upsertSteps(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpsertStepsDto,
  ) {
    return this.tests.upsertSteps(id, user.id, dto)
  }
}
