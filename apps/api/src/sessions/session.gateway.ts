import {
  WebSocketGateway, WebSocketServer,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { OnEvent } from '@nestjs/event-emitter'
import type { BrowserTab } from '@iris/common'

@WebSocketGateway({
  namespace: '/sessions',
  cors: {
    origin: process.env.WEB_URL ?? 'http://localhost:3001',
    credentials: true,
  },
})
export class SessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server

  handleConnection(client: Socket) {
    const runId = client.handshake.query.runId as string
    if (!runId) return client.disconnect()
    client.join(`run:${runId}`)
  }

  handleDisconnect(_client: Socket) {}

  @OnEvent('run.*.frame')
  handleFrame(payload: { runId: string; frameBase64: string }) {
    this.server.to(`run:${payload.runId}`).emit('frame', { frameBase64: payload.frameBase64 })
  }

  @OnEvent('run.*.step')
  handleStep(payload: { runId: string; step: unknown }) {
    this.server.to(`run:${payload.runId}`).emit('event', { type: 'step.completed', step: payload.step })
  }

  @OnEvent('run.*.started')
  handleStarted(payload: { runId: string; liveViewUrl: string | null }) {
    this.server.to(`run:${payload.runId}`).emit('event', { type: 'run.started', liveViewUrl: payload.liveViewUrl })
  }

  @OnEvent('run.*.completed')
  handleCompleted(payload: { runId: string; result: unknown }) {
    this.server.to(`run:${payload.runId}`).emit('event', { type: 'run.completed', result: payload.result })
  }

  @OnEvent('author.*.ready')
  handleAuthorReady(payload: { sessionId: string }) {
    this.server.to(`run:${payload.sessionId}`).emit('event', { type: 'author.ready' })
  }

  @OnEvent('author.*.step.started')
  handleAuthorStepStarted(payload: { sessionId: string; pos: number }) {
    this.server.to(`run:${payload.sessionId}`).emit('event', { type: 'author.step.started', pos: payload.pos })
  }

  @OnEvent('author.*.step.completed')
  handleAuthorStepCompleted(payload: { sessionId: string; pos: number; passed: boolean }) {
    this.server.to(`run:${payload.sessionId}`).emit('event', { type: 'author.step.completed', pos: payload.pos, passed: payload.passed })
  }

  @OnEvent('author.*.browser')
  handleAuthorBrowser(payload: Record<string, unknown>) {
    const { sessionId, ...rest } = payload
    this.server.to(`run:${sessionId as string}`).emit('event', { type: 'author.browser', ...rest })
  }

  @OnEvent('author.*.tabs')
  handleAuthorTabs(payload: { sessionId: string; tabs: BrowserTab[] }) {
    this.server.to(`run:${payload.sessionId}`).emit('event', { type: 'author.tabs', tabs: payload.tabs })
  }
}
