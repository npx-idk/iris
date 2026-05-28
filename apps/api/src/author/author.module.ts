import { Module } from "@nestjs/common"
import { AuthoringController } from "./author.controller"
import { AuthoringService } from "./author.service"
import { CommonModule } from "../common/common.module"
import { WorkspaceModule } from "../workspace/workspace.module"

@Module({
  imports: [CommonModule, WorkspaceModule],
  controllers: [AuthoringController],
  providers: [AuthoringService],
})
export class AuthoringModule {}
