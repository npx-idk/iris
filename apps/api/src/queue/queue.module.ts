import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { QueueService } from './queue.service'
import { TestRunProcessor } from './test-run.processor'
import { ArtifactsService } from '../common/artifacts.service'
import { RUN_QUEUE } from './queue.constants'

export { RUN_QUEUE } from './queue.constants'
export type { RunJobPayload } from './queue.constants'

@Module({
  imports: [BullModule.registerQueue({ name: RUN_QUEUE })],
  providers: [QueueService, TestRunProcessor, ArtifactsService],
  exports: [QueueService, ArtifactsService],
})
export class QueueModule {}
