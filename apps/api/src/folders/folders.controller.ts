import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { FoldersService } from './folders.service'
import { CreateFolderDto } from './dto/create-folder.dto'
import { UpdateFolderDto } from './dto/update-folder.dto'

@UseGuards(AuthGuard)
@Controller()
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get('projects/:projectId/folders')
  findAll(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    return this.folders.findAll(projectId, user.id)
  }

  @Post('projects/:projectId/folders')
  create(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.folders.create(projectId, user.id, dto)
  }

  @Patch('folders/:id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateFolderDto) {
    return this.folders.update(id, user.id, dto)
  }

  @Delete('folders/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.folders.remove(id, user.id)
  }
}
