import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectRolesGuard } from './guards/project-roles.guard';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectRolesGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
