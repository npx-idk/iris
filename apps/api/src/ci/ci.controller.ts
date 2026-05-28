import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
} from "@nestjs/common"
import { ApiKeyGuard } from "../auth/api-key.guard"
import { CurrentUser } from "../auth/current-user.decorator"
import { CurrentApiKeyProjectId } from "../auth/current-api-key-project-id.decorator"
import { RunsService } from "../runs/runs.service"

@UseGuards(ApiKeyGuard)
@Controller("ci")
export class CiController {
  constructor(private runs: RunsService) {}

  // Trigger all enabled tests in a project.
  @Post("projects/:projectId/runs")
  triggerProject(
    @CurrentUser() user: any,
    @Param("projectId") projectId: string
  ) {
    return this.runs.triggerProject(projectId, user.id, "API")
  }

  // Trigger a single test.
  @Post("tests/:testId/runs")
  triggerTest(
    @CurrentUser() user: any,
    @CurrentApiKeyProjectId() apiKeyProjectId: string | null,
    @Param("testId") testId: string
  ) {
    return this.runs.triggerTest(testId, user.id, {
      trigger: "API",
      apiKeyProjectId: apiKeyProjectId ?? undefined,
    })
  }

  // Poll a single run's status + step results — no session required.
  @Get("runs/:id")
  getRun(@CurrentUser() user: any, @Param("id") id: string) {
    return this.runs.findOne(id, user.id)
  }

  // Cancel a run.
  @Post("runs/:id/cancel")
  @HttpCode(204)
  cancel(@CurrentUser() user: any, @Param("id") id: string) {
    return this.runs.cancel(id, user.id)
  }
}
