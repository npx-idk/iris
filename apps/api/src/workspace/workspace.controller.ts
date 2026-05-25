import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkspaceService } from './workspace.service';
import { CreateVariableDto } from './dto/create-variable.dto';
import { UpdateVariableDto } from './dto/update-variable.dto';

@UseGuards(AuthGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get()
  getWorkspace(@CurrentUser() user: any) {
    return this.workspace.findForUser(user.id);
  }

  @Get('variables')
  listVariables(@CurrentUser() user: any) {
    return this.workspace.listVariables(user.id);
  }

  @Post('variables')
  createVariable(@CurrentUser() user: any, @Body() dto: CreateVariableDto) {
    return this.workspace.createVariable(user.id, dto);
  }

  @Patch('variables/:varId')
  updateVariable(
    @CurrentUser() user: any,
    @Param('varId') varId: string,
    @Body() dto: UpdateVariableDto,
  ) {
    return this.workspace.updateVariable(user.id, varId, dto);
  }

  @Delete('variables/:varId')
  @HttpCode(204)
  deleteVariable(@CurrentUser() user: any, @Param('varId') varId: string) {
    return this.workspace.deleteVariable(user.id, varId);
  }
}
