import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { ExploreService } from './explore.service'
import { ExploreDto } from './dto/explore.dto'

@UseGuards(AuthGuard)
@Controller()
export class ExploreController {
  constructor(private readonly explore: ExploreService) {}

  @Post('projects/:projectId/explore')
  exploreProject(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: ExploreDto,
  ) {
    return this.explore.explore(projectId, user.id, dto)
  }
}
