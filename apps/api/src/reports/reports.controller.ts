import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from "@nestjs/common"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser, RequestUser } from "../auth/current-user.decorator"
import { ReportsService } from "./reports.service"
import { ShareReportDto } from "./dto/share-report.dto"

@UseGuards(AuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Post("share")
  share(@CurrentUser() user: RequestUser, @Body() dto: ShareReportDto) {
    return this.reports.share(user.id, dto.runId, dto.title, dto.content)
  }

  @Get("share/:runId")
  findShareForRun(
    @CurrentUser() user: RequestUser,
    @Param("runId") runId: string
  ) {
    return this.reports.findShareForRun(runId, user.id)
  }

  @Delete("share/:runId")
  @HttpCode(204)
  revoke(@CurrentUser() user: RequestUser, @Param("runId") runId: string) {
    return this.reports.revoke(user.id, runId)
  }
}
