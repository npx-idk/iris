import { Module, forwardRef } from "@nestjs/common"
import { RunsController } from "./runs.controller"
import { RunsService } from "./runs.service"
import { QueueModule } from "../queue/queue.module"
import { FlowsModule } from "../flows/flows.module"
import { CommonModule } from "../common/common.module"

@Module({
  imports: [forwardRef(() => QueueModule), FlowsModule, CommonModule],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
