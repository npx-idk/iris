import { Module } from '@nestjs/common'
import { AuthoringController } from './author.controller'
import { AuthoringService } from './author.service'

@Module({
  controllers: [AuthoringController],
  providers: [AuthoringService],
})
export class AuthoringModule {}
