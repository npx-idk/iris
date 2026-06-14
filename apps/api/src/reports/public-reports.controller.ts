import { Controller, Get, Param } from "@nestjs/common"
import { ReportsService } from "./reports.service"

/** Unauthenticated access to published report snapshots by share token. */
@Controller("public/reports")
export class PublicReportsController {
  constructor(private reports: ReportsService) {}

  @Get(":token")
  findOne(@Param("token") token: string) {
    return this.reports.findPublic(token)
  }

  @Get(":token/frames")
  getFrames(@Param("token") token: string) {
    return this.reports.findPublicFrames(token)
  }

  @Get(":token/events")
  getEvents(@Param("token") token: string) {
    return this.reports.findPublicEvents(token)
  }
}
