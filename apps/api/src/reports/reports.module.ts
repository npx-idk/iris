import { Module } from "@nestjs/common"
import { ReportsController } from "./reports.controller"
import { PublicReportsController } from "./public-reports.controller"
import { ReportsService } from "./reports.service"
import { CommonModule } from "../common/common.module"

@Module({
  imports: [CommonModule],
  controllers: [ReportsController, PublicReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
