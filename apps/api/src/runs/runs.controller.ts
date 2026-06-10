import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  Sse,
  MessageEvent,
} from "@nestjs/common"
import { Observable, fromEvent, merge, timer, from } from "rxjs"
import { map, takeUntil, switchMap, filter } from "rxjs/operators"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { EVENTS, WORKSPACE_RUN_CHANGED } from "@iris/common"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser, RequestUser } from "../auth/current-user.decorator"
import { RunsService } from "./runs.service"
import { RunTriggerService } from "./run-trigger.service"

@UseGuards(AuthGuard)
@Controller()
export class RunsController {
  constructor(
    private runs: RunsService,
    private trigger: RunTriggerService,
    private eventEmitter: EventEmitter2
  ) {}

  @Post("tests/:testId/runs")
  triggerTest(
    @CurrentUser() user: RequestUser,
    @Param("testId") testId: string,
    @Body() body: { skipPrerequisites?: boolean } = {}
  ) {
    return this.trigger.triggerTest(testId, user.id, {
      skipPrerequisites: body.skipPrerequisites,
    })
  }

  @Post("flows/:id/runs")
  triggerFlow(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.trigger.triggerFlow(id, user.id)
  }

  @Post("projects/:projectId/runs")
  triggerProject(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string
  ) {
    return this.trigger.triggerProject(projectId, user.id)
  }

  @Get("runs/active")
  findActive(@CurrentUser() user: RequestUser) {
    return this.runs.findActive(user.id)
  }

  @Sse("runs/stream")
  streamWorkspace(@CurrentUser() user: RequestUser): Observable<MessageEvent> {
    return from(this.runs.getUserProjectIds(user.id)).pipe(
      switchMap((projectIds) => {
        const projectIdSet = new Set(projectIds)
        const ping$ = timer(0, 15_000).pipe(
          map(() => ({ type: "ping", data: "{}" }) as MessageEvent)
        )
        const run$ = fromEvent(this.eventEmitter, WORKSPACE_RUN_CHANGED).pipe(
          filter((data: any) => projectIdSet.has(data.test?.project?.id)),
          map(
            (data) =>
              ({ type: "run", data: JSON.stringify(data) }) as MessageEvent
          )
        )
        return merge(ping$, run$)
      })
    )
  }

  @Get("runs/:id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.runs.findOne(id, user.id)
  }

  @Get("tests/:testId/runs")
  findAllForTest(
    @CurrentUser() user: RequestUser,
    @Param("testId") testId: string
  ) {
    return this.runs.findAllForTest(testId, user.id)
  }

  @Get("runs/:id/frames")
  getFrames(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.runs.getFrames(id, user.id)
  }

  @Get("runs/:id/events")
  getBrowserEvents(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.runs.getBrowserEvents(id, user.id)
  }

  @Post("runs/:id/cancel")
  @HttpCode(204)
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.runs.cancel(id, user.id)
  }

  @Sse("runs/:id/stream")
  stream(@Param("id") runId: string): Observable<MessageEvent> {
    const step$ = fromEvent(this.eventEmitter, EVENTS.RUN_STEP(runId)).pipe(
      map(
        (data) => ({ type: "step", data: JSON.stringify(data) }) as MessageEvent
      )
    )
    const completed$ = fromEvent(this.eventEmitter, EVENTS.RUN_COMPLETED(runId))
    const done$ = completed$.pipe(
      map(
        (data) =>
          ({ type: "completed", data: JSON.stringify(data) }) as MessageEvent
      )
    )
    const ping$ = timer(0, 15_000).pipe(
      map(() => ({ type: "ping", data: "{}" }) as MessageEvent)
    )

    return merge(step$, done$, ping$).pipe(takeUntil(completed$))
  }
}
