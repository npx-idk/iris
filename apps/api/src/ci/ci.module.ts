import { Module } from '@nestjs/common'
import { CiController } from './ci.controller'
import { RunsModule } from '../runs/runs.module'

@Module({
  imports: [RunsModule],
  controllers: [CiController],
})
export class CiModule {}
