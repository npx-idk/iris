import { Module, forwardRef } from "@nestjs/common"
import { BullModule } from "@nestjs/bull"
import { QueueService } from "./queue.service"
import { TestRunProcessor } from "./test-run.processor"
import { RunExecutorService } from "./run-executor.service"
import { ArtifactsService } from "../common/artifacts.service"
import { RUN_QUEUE } from "./queue.constants"
import { RunsModule } from "../runs/runs.module"
import { WorkspaceModule } from "../workspace/workspace.module"

export { RUN_QUEUE } from "./queue.constants"
export type { RunJobPayload } from "./queue.constants"

@Module({
  imports: [
    BullModule.registerQueue({ name: RUN_QUEUE }),
    forwardRef(() => RunsModule),
    WorkspaceModule,
  ],
  providers: [
    QueueService,
    TestRunProcessor,
    RunExecutorService,
    ArtifactsService,
  ],
  exports: [QueueService, ArtifactsService],
})
export class QueueModule {}
