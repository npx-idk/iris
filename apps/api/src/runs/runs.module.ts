import { Module, forwardRef } from "@nestjs/common"
import { RunsController } from "./runs.controller"
import { RunsService } from "./runs.service"
import { RunTriggerService } from "./run-trigger.service"
import { QueueModule } from "../queue/queue.module"
import { FlowsModule } from "../flows/flows.module"
import { CommonModule } from "../common/common.module"

@Module({
  imports: [forwardRef(() => QueueModule), FlowsModule, CommonModule],
  controllers: [RunsController],
  providers: [RunsService, RunTriggerService],
  exports: [RunsService, RunTriggerService],
})
export class RunsModule {}
