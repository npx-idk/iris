import { Module } from '@nestjs/common'
import { RunsController } from './runs.controller'
import { RunsService } from './runs.service'
import { QueueModule } from '../queue/queue.module'
import { ArtifactsService } from '../common/artifacts.service'

@Module({
  imports: [QueueModule],
  controllers: [RunsController],
  providers: [RunsService, ArtifactsService],
  exports: [RunsService],
})
export class RunsModule {}
