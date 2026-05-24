import {
  Controller, Post, Get, Delete, Param, Body, UseGuards, HttpCode,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { AuthoringService } from './author.service'
import { RunStepDto } from './dto/run-step.dto'
import { SeekDto } from './dto/seek.dto'
import { DispatchInputDto } from './dto/dispatch-input.dto'
import { NewTabDto } from './dto/new-tab.dto'
import { NavigateDto } from './dto/navigate.dto'

@UseGuards(AuthGuard)
@Controller()
export class AuthoringController {
  constructor(private authoring: AuthoringService) {}

  @Post('tests/:testId/author')
  startSession(@CurrentUser() user: any, @Param('testId') testId: string) {
    return this.authoring.startSession(testId, user.id)
  }

  @Post('author/:sessionId/step')
  runStep(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: RunStepDto,
  ) {
    return this.authoring.runStep(sessionId, user.id, dto.instruction, dto.description, dto.variables)
  }

  @Post('author/:sessionId/input')
  @HttpCode(204)
  dispatchInput(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: DispatchInputDto,
  ) {
    return this.authoring.dispatchInput(sessionId, user.id, dto)
  }

  @Post('author/:sessionId/seek')
  @HttpCode(204)
  seek(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: SeekDto,
  ) {
    return this.authoring.seek(sessionId, user.id, dto.fromFlatPos, dto.toFlatPos, dto.navigate)
  }

  @Post('author/:sessionId/navigate')
  @HttpCode(204)
  navigate(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: NavigateDto,
  ) {
    return this.authoring.navigate(sessionId, user.id, dto.url)
  }

  @Post('author/:sessionId/back')
  @HttpCode(204)
  goBack(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.authoring.goBack(sessionId, user.id)
  }

  @Post('author/:sessionId/forward')
  @HttpCode(204)
  goForward(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.authoring.goForward(sessionId, user.id)
  }

  @Post('author/:sessionId/reload')
  @HttpCode(204)
  reload(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.authoring.reload(sessionId, user.id)
  }

  @Get('author/:sessionId/tabs')
  listTabs(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.authoring.listTabs(sessionId, user.id)
  }

  @Post('author/:sessionId/tabs')
  newTab(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: NewTabDto,
  ) {
    return this.authoring.newTab(sessionId, user.id, dto.url)
  }

  @Post('author/:sessionId/tabs/:targetId/activate')
  @HttpCode(204)
  activateTab(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Param('targetId') targetId: string,
  ) {
    return this.authoring.activateTab(sessionId, user.id, targetId)
  }

  @Delete('author/:sessionId/tabs/:targetId')
  @HttpCode(204)
  closeTab(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Param('targetId') targetId: string,
  ) {
    return this.authoring.closeTab(sessionId, user.id, targetId)
  }

  @Get('author/:sessionId/application-data')
  getApplicationData(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.authoring.getApplicationData(sessionId, user.id)
  }

  @Get('author/:sessionId/devtools-url')
  getDevtoolsUrl(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.authoring.getDevtoolsUrl(sessionId, user.id)
  }

  @Delete('author/:sessionId')
  @HttpCode(204)
  closeSession(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.authoring.closeSession(sessionId, user.id)
  }
}
