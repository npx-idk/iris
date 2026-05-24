import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { ProjectsModule } from './projects/projects.module'
import { TestsModule } from './tests/tests.module'
import { RunsModule } from './runs/runs.module'
import { QueueModule } from './queue/queue.module'
import { SessionModule } from './sessions/session.module'
import { AuthoringModule } from './author/author.module'
import { CiModule } from './ci/ci.module'

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: true }),
    BullModule.forRoot({
      redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
    }),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    TestsModule,
    RunsModule,
    QueueModule,
    SessionModule,
    AuthoringModule,
    CiModule,
  ],
})
export class AppModule {}
