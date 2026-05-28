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
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser } from "../auth/current-user.decorator"
import { RunsService } from "./runs.service"

@UseGuards(AuthGuard)
@Controller()
export class RunsController {
  constructor(
    private runs: RunsService,
    private eventEmitter: EventEmitter2
  ) {}

  @Post("tests/:testId/runs")
  triggerTest(
    @CurrentUser() user: any,
    @Param("testId") testId: string,
    @Body() body: { skipPrerequisites?: boolean } = {}
  ) {
    return this.runs.triggerTest(testId, user.id, {
      skipPrerequisites: body.skipPrerequisites,
    })
  }

  @Post("flows/:id/runs")
  triggerFlow(@CurrentUser() user: any, @Param("id") id: string) {
    return this.runs.triggerFlow(id, user.id)
  }

  @Post("projects/:projectId/runs")
  triggerProject(
    @CurrentUser() user: any,
    @Param("projectId") projectId: string
  ) {
    return this.runs.triggerProject(projectId, user.id)
  }

  @Get("runs/active")
  findActive(@CurrentUser() user: any) {
    return this.runs.findActive(user.id)
  }

  @Sse("runs/stream")
  streamWorkspace(@CurrentUser() user: any): Observable<MessageEvent> {
    return from(this.runs.getUserProjectIds(user.id)).pipe(
      switchMap((projectIds) => {
        const projectIdSet = new Set(projectIds)
        const ping$ = timer(0, 15_000).pipe(
          map(() => ({ type: "ping", data: "{}" }) as MessageEvent)
        )
        const run$ = fromEvent(this.eventEmitter, "workspace.run.changed").pipe(
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
  findOne(@CurrentUser() user: any, @Param("id") id: string) {
    return this.runs.findOne(id, user.id)
  }

  @Get("tests/:testId/runs")
  findAllForTest(@CurrentUser() user: any, @Param("testId") testId: string) {
    return this.runs.findAllForTest(testId, user.id)
  }

  @Get("runs/:id/frames")
  getFrames(@CurrentUser() user: any, @Param("id") id: string) {
    return this.runs.getFrames(id, user.id)
  }

  @Get("runs/:id/events")
  getBrowserEvents(@CurrentUser() user: any, @Param("id") id: string) {
    return this.runs.getBrowserEvents(id, user.id)
  }

  @Post("runs/:id/cancel")
  @HttpCode(204)
  cancel(@CurrentUser() user: any, @Param("id") id: string) {
    return this.runs.cancel(id, user.id)
  }

  @Sse("runs/:id/stream")
  stream(@Param("id") runId: string): Observable<MessageEvent> {
    const step$ = fromEvent(this.eventEmitter, `run.${runId}.step`).pipe(
      map(
        (data) => ({ type: "step", data: JSON.stringify(data) }) as MessageEvent
      )
    )
    const completed$ = fromEvent(this.eventEmitter, `run.${runId}.completed`)
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
