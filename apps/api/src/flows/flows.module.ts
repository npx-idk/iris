import { Module } from "@nestjs/common"
import { FlowsController } from "./flows.controller"
import { FlowsService } from "./flows.service"
import { CommonModule } from "../common/common.module"

@Module({
  imports: [CommonModule],
  controllers: [FlowsController],
  providers: [FlowsService],
  exports: [FlowsService],
})
export class FlowsModule {}
