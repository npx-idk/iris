import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets"
import { Server, Socket } from "socket.io"
import { OnEvent } from "@nestjs/event-emitter"
import { EVENT_PATTERNS, type BrowserTab } from "@iris/common"
import { env } from "../config/env"

@WebSocketGateway({
  namespace: "/sessions",
  cors: {
    origin: env.webUrl,
    credentials: true,
  },
})
export class SessionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server

  handleConnection(client: Socket) {
    const runId = client.handshake.query.runId as string
    if (!runId) return client.disconnect()
    client.join(`run:${runId}`)
  }

  handleDisconnect(_client: Socket) {}

  @OnEvent(EVENT_PATTERNS.RUN_FRAME)
  handleFrame(payload: { runId: string; frameBase64: string }) {
    this.server
      .to(`run:${payload.runId}`)
      .emit("frame", { frameBase64: payload.frameBase64 })
  }

  @OnEvent(EVENT_PATTERNS.RUN_STEP)
  handleStep(payload: { runId: string; step: unknown }) {
    this.server
      .to(`run:${payload.runId}`)
      .emit("event", { type: "step.completed", step: payload.step })
  }

  @OnEvent(EVENT_PATTERNS.RUN_STARTED)
  handleStarted(payload: { runId: string; liveViewUrl: string | null }) {
    this.server
      .to(`run:${payload.runId}`)
      .emit("event", { type: "run.started", liveViewUrl: payload.liveViewUrl })
  }

  @OnEvent(EVENT_PATTERNS.RUN_COMPLETED)
  handleCompleted(payload: { runId: string; result: unknown }) {
    this.server
      .to(`run:${payload.runId}`)
      .emit("event", { type: "run.completed", result: payload.result })
  }

  @OnEvent(EVENT_PATTERNS.AUTHOR_READY)
  handleAuthorReady(payload: { sessionId: string }) {
    this.server
      .to(`run:${payload.sessionId}`)
      .emit("event", { type: "author.ready" })
  }

  @OnEvent(EVENT_PATTERNS.AUTHOR_STEP_STARTED)
  handleAuthorStepStarted(payload: { sessionId: string; pos: number }) {
    this.server
      .to(`run:${payload.sessionId}`)
      .emit("event", { type: "author.step.started", pos: payload.pos })
  }

  @OnEvent(EVENT_PATTERNS.AUTHOR_STEP_COMPLETED)
  handleAuthorStepCompleted(payload: {
    sessionId: string
    pos: number
    passed: boolean
  }) {
    this.server
      .to(`run:${payload.sessionId}`)
      .emit("event", {
        type: "author.step.completed",
        pos: payload.pos,
        passed: payload.passed,
      })
  }

  @OnEvent(EVENT_PATTERNS.AUTHOR_BROWSER)
  handleAuthorBrowser(payload: Record<string, unknown>) {
    const { sessionId, ...rest } = payload
    this.server
      .to(`run:${sessionId as string}`)
      .emit("event", { type: "author.browser", ...rest })
  }

  @OnEvent(EVENT_PATTERNS.AUTHOR_TABS)
  handleAuthorTabs(payload: { sessionId: string; tabs: BrowserTab[] }) {
    this.server
      .to(`run:${payload.sessionId}`)
      .emit("event", { type: "author.tabs", tabs: payload.tabs })
  }
}
