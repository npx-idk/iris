import { Module } from "@nestjs/common"
import { ProjectsController } from "./projects.controller"
import { ProjectsService } from "./projects.service"
import { MembersService } from "./members.service"
import { ApiKeysService } from "./api-keys.service"
import { ProjectRolesGuard } from "./guards/project-roles.guard"
import { WorkspaceModule } from "../workspace/workspace.module"
import { CommonModule } from "../common/common.module"

@Module({
  imports: [WorkspaceModule, CommonModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    MembersService,
    ApiKeysService,
    ProjectRolesGuard,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
