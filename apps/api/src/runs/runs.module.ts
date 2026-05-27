import { Module, forwardRef } from '@nestjs/common'
import { RunsController } from './runs.controller'
import { RunsService } from './runs.service'
import { QueueModule } from '../queue/queue.module'
import { ArtifactsService } from '../common/artifacts.service'
import { FlowsModule } from '../flows/flows.module'

@Module({
  imports: [forwardRef(() => QueueModule), FlowsModule],
  controllers: [RunsController],
  providers: [RunsService, ArtifactsService],
  exports: [RunsService],
})
export class RunsModule {}
