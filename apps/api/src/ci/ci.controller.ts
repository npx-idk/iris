import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
} from "@nestjs/common"
import { ApiKeyGuard } from "../auth/api-key.guard"
import { CurrentUser, RequestUser } from "../auth/current-user.decorator"
import { CurrentApiKeyProjectId } from "../auth/current-api-key-project-id.decorator"
import { RunsService } from "../runs/runs.service"
import { RunTriggerService } from "../runs/run-trigger.service"

@UseGuards(ApiKeyGuard)
@Controller("ci")
export class CiController {
  constructor(
    private runs: RunsService,
    private trigger: RunTriggerService
  ) {}

  // Trigger all enabled tests in a project.
  @Post("projects/:projectId/runs")
  triggerProject(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string
  ) {
    return this.trigger.triggerProject(projectId, user.id, "API")
  }

  // Trigger a single test.
  @Post("tests/:testId/runs")
  triggerTest(
    @CurrentUser() user: RequestUser,
    @CurrentApiKeyProjectId() apiKeyProjectId: string | null,
    @Param("testId") testId: string
  ) {
    return this.trigger.triggerTest(testId, user.id, {
      trigger: "API",
      apiKeyProjectId: apiKeyProjectId ?? undefined,
    })
  }

  // Poll a single run's status + step results — no session required.
  @Get("runs/:id")
  getRun(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.runs.findOne(id, user.id)
  }

  // Cancel a run.
  @Post("runs/:id/cancel")
  @HttpCode(204)
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.runs.cancel(id, user.id)
  }
}
