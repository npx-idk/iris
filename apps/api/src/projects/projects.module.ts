import { Module } from "@nestjs/common"
import { ProjectsController } from "./projects.controller"
import { ProjectsService } from "./projects.service"
import { ProjectRolesGuard } from "./guards/project-roles.guard"
import { WorkspaceModule } from "../workspace/workspace.module"
import { CommonModule } from "../common/common.module"

@Module({
  imports: [WorkspaceModule, CommonModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectRolesGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
