import { Module } from "@nestjs/common"
import { ExploreController } from "./explore.controller"
import { ExploreService } from "./explore.service"
import { CommonModule } from "../common/common.module"
import { WorkspaceModule } from "../workspace/workspace.module"

@Module({
  imports: [CommonModule, WorkspaceModule],
  controllers: [ExploreController],
  providers: [ExploreService],
})
export class ExploreModule {}
