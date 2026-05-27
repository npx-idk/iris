import { Module, forwardRef } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { QueueService } from './queue.service'
import { TestRunProcessor } from './test-run.processor'
import { ArtifactsService } from '../common/artifacts.service'
import { RUN_QUEUE } from './queue.constants'
import { RunsModule } from '../runs/runs.module'

export { RUN_QUEUE } from './queue.constants'
export type { RunJobPayload } from './queue.constants'

@Module({
  imports: [BullModule.registerQueue({ name: RUN_QUEUE }), forwardRef(() => RunsModule)],
  providers: [QueueService, TestRunProcessor, ArtifactsService],
  exports: [QueueService, ArtifactsService],
})
export class QueueModule {}
