import { Module } from "@nestjs/common"
import { TestsController } from "./tests.controller"
import { TestsService } from "./tests.service"
import { PrerequisitesService } from "./prerequisites.service"
import { SuiteTransferService } from "./suite-transfer.service"
import { CommonModule } from "../common/common.module"

@Module({
  imports: [CommonModule],
  controllers: [TestsController],
  providers: [TestsService, PrerequisitesService, SuiteTransferService],
  exports: [TestsService],
})
export class TestsModule {}
