import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { GroupsService } from './groups.service'
import { CreateGroupDto } from './dto/create-group.dto'
import { UpdateGroupDto } from './dto/update-group.dto'

@UseGuards(AuthGuard)
@Controller()
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get('projects/:projectId/groups')
  findAll(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    return this.groups.findAll(projectId, user.id)
  }

  @Post('projects/:projectId/groups')
  create(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groups.create(projectId, user.id, dto)
  }

  @Patch('groups/:id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groups.update(id, user.id, dto)
  }

  @Delete('groups/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.groups.remove(id, user.id)
  }
}
