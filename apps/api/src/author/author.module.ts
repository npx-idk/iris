import { Module } from "@nestjs/common"
import { AuthoringController } from "./author.controller"
import { AuthoringService } from "./author.service"
import { ReplayService } from "./replay.service"
import { SessionRegistry } from "./session-registry"
import { CommonModule } from "../common/common.module"
import { WorkspaceModule } from "../workspace/workspace.module"

@Module({
  imports: [CommonModule, WorkspaceModule],
  controllers: [AuthoringController],
  providers: [AuthoringService, ReplayService, SessionRegistry],
})
export class AuthoringModule {}
