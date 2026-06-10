import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { RUN_QUEUE, RunJobPayload } from './queue.constants'

@Injectable()
export class QueueService {
  constructor(@InjectQueue(RUN_QUEUE) private runQueue: Queue) {}

  async enqueueRun(payload: RunJobPayload): Promise<void> {
    await this.runQueue.add('execute', payload, {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 200,
    })
  }
}
