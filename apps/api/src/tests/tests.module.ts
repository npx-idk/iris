import { Module } from "@nestjs/common"
import { TestsController } from "./tests.controller"
import { TestsService } from "./tests.service"
import { CommonModule } from "../common/common.module"

@Module({
  imports: [CommonModule],
  controllers: [TestsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}
