import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectRolesGuard } from './guards/project-roles.guard';
import { ProjectRoles } from './decorators/project-roles.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@UseGuards(AuthGuard, ProjectRolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // ─── Projects ──────────────────────────────────────────────────────────────

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.projects.findAllForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projects.findOne(id, user.id);
  }

  @Patch(':id')
  @ProjectRoles('OWNER', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ProjectRoles('OWNER')
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  // ─── Members ───────────────────────────────────────────────────────────────

  @Post(':id/members')
  @ProjectRoles('OWNER', 'ADMIN')
  inviteMember(@Param('id') id: string, @Body() dto: InviteMemberDto) {
    return this.projects.inviteMember(id, dto);
  }

  @Patch(':id/members/:memberId')
  @ProjectRoles('OWNER')
  updateMemberRole(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.projects.updateMemberRole(id, user.id, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.projects.removeMember(id, user.id, memberId);
  }

  // ─── API Keys ──────────────────────────────────────────────────────────────

  @Get(':id/api-keys')
  @ProjectRoles('OWNER', 'ADMIN')
  listApiKeys(@Param('id') id: string) {
    return this.projects.listApiKeys(id);
  }

  @Post(':id/api-keys')
  @ProjectRoles('OWNER', 'ADMIN')
  createApiKey(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.projects.createApiKey(id, user.id, dto);
  }

  @Delete(':id/api-keys/:keyId')
  @HttpCode(204)
  @ProjectRoles('OWNER', 'ADMIN')
  revokeApiKey(@Param('id') id: string, @Param('keyId') keyId: string) {
    return this.projects.revokeApiKey(id, keyId);
  }
}
