# Iris — Phase 3b: Migrate to Agentic Runner (Stagehand + Browserbase)

## What Changes

```
REMOVE:
  - StepAction enum
  - SelectorType enum
  - TestStep.action, selector, selectorType, value, waitBefore, timeoutMs
  - packages/runner (Playwright executor) → replace with Stagehand agent

ADD:
  - TestStep.instruction  (plain English: "Click the login button")
  - TestStep.variables    (JSON: sensitive values kept out of LLM)
  - TestRunStep.cacheStatus (HIT | MISS from Stagehand)
  - packages/agent        (replaces packages/runner)
  - BROWSER_ENV, BROWSERBASE_* env vars
```

---

## Step 1 — Schema Migration

Replace the test/runs section of `packages/database/prisma/schema.prisma`.
Remove the enums and simplify `TestStep`.

**Remove these enums entirely:**
```prisma
// DELETE THESE:
enum StepAction { ... }
enum SelectorType { ... }
```

**Replace `TestStep` model:**
```prisma
model TestStep {
  id           String   @id @default(cuid())
  stepIndex    Int
  instruction  String   // plain English: "Click the Sign In button"
  description  String?  // optional human label shown in UI
  variables    Json?    // { "password": "secret" } — NOT sent to LLM
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  testId       String
  test         Test     @relation(fields: [testId], references: [id], onDelete: Cascade)

  stepResults  TestRunStep[]

  @@unique([testId, stepIndex])
  @@map("test_steps")
}
```

**Replace `TestRunStep` model:**
```prisma
model TestRunStep {
  id           String     @id @default(cuid())
  stepIndex    Int
  instruction  String
  description  String?
  result       StepResult
  cacheStatus  String?    // "HIT" | "MISS" — from Stagehand act()
  errorMessage String?
  durationMs   Int        @default(0)
  screenshotUrl String?
  createdAt    DateTime   @default(now())

  runId        String
  run          TestRun    @relation(fields: [runId], references: [id], onDelete: Cascade)

  testStepId   String?
  testStep     TestStep?  @relation(fields: [testStepId], references: [id], onDelete: SetNull)

  @@map("test_run_steps")
}
```

**Add metrics fields to `TestRun`:**
```prisma
model TestRun {
  // ... existing fields ...
  totalTokens        Int?
  inferenceTimeMs    Int?
  cacheHits          Int?
  browserEnv         String?  // "LOCAL" | "BROWSERBASE"
  liveViewUrl        String?
}
```

Keep `StepResult` and `RunStatus` enums — they're still valid.

Then:
```bash
pnpm db:generate
pnpm db:migrate
# migration name: migrate_to_agent_steps
```

---

## Step 2 — Create `packages/agent`

Replace `packages/runner` entirely. The agent package uses Stagehand.

```bash
mkdir -p packages/agent/src
```

**`packages/agent/package.json`**
```json
{
  "name": "@iris/agent",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@browserbasehq/stagehand": "^3.0.0",
    "@browserbasehq/sdk": "^2.0.0"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "@types/node": "^22.0.0",
    "typescript": "5.9.3"
  }
}
```

**`packages/agent/tsconfig.json`**
```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "ES2021"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**`packages/agent/src/types.ts`**
```typescript
export type StepResult = 'PASSED' | 'FAILED' | 'SKIPPED'
export type RunStatus = 'PASSED' | 'FAILED' | 'CANCELLED'
export type BrowserEnv = 'LOCAL' | 'BROWSERBASE'
export type CacheStatus = 'HIT' | 'MISS' | undefined

export interface AgentStep {
  id: string               // TestStep.id
  stepIndex: number
  instruction: string      // plain English — sent to Stagehand act()
  description?: string     // human label for UI
  variables?: Record<string, string>  // NOT sent to LLM
}

export interface StepLog {
  stepIndex: number
  testStepId: string
  instruction: string
  description?: string
  result: StepResult
  cacheStatus?: CacheStatus
  errorMessage?: string
  durationMs: number
}

export interface RunMetrics {
  totalTokens: number
  inferenceTimeMs: number
  cacheHits: number
  cacheMisses: number
}

export interface RunResult {
  runId: string
  status: RunStatus
  stepLogs: StepLog[]
  metrics: RunMetrics
  liveViewUrl?: string
  errorMessage?: string
  totalDurationMs: number
}

export interface RunConfig {
  runId: string
  testId: string
  startUrl: string
  steps: AgentStep[]
  env: BrowserEnv
  geminiApiKey: string
  browserbaseApiKey?: string
  browserbaseProjectId?: string
  onStepComplete?: (log: StepLog) => void | Promise<void>
  onFrame?: (frameBase64: string) => void | Promise<void>
}
```

**`packages/agent/src/agent.ts`**
```typescript
import { Stagehand } from '@browserbasehq/stagehand'
import { Browserbase } from '@browserbasehq/sdk'
import { RunConfig, RunResult, StepLog, RunMetrics } from './types'

export async function runTest(config: RunConfig): Promise<RunResult> {
  const startedAt = Date.now()
  const stepLogs: StepLog[] = []

  if (config.steps.length === 0) {
    return {
      runId: config.runId,
      status: 'FAILED',
      stepLogs: [],
      metrics: { totalTokens: 0, inferenceTimeMs: 0, cacheHits: 0, cacheMisses: 0 },
      errorMessage: 'Test has no steps',
      totalDurationMs: 0,
    }
  }

  // ── Init Stagehand ────────────────────────────────────────────────────────

  const stagehand = new Stagehand({
    env: config.env,

    // Gemini 2.0 Flash as the AI model
    modelName: 'google/gemini-2.0-flash-lite',
    modelClientOptions: { apiKey: config.geminiApiKey },

    ...(config.env === 'BROWSERBASE' && {
      apiKey: config.browserbaseApiKey,
      projectId: config.browserbaseProjectId,
      serverCache: true,
      browserbaseSessionCreateParams: {
        browserSettings: {
          blockAds: true,
          solveCaptchas: true,
          recordSession: true,
          viewport: { width: 1280, height: 720 },
        },
      },
    }),

    ...(config.env === 'LOCAL' && {
      localBrowserLaunchOptions: {
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    }),

    selfHeal: true,         // auto-retry failed actions
    domSettleTimeout: 2000,
    verbose: 0,
  })

  await stagehand.init()

  // ── Live view URL ────────────────────────────────────────────────────────

  let liveViewUrl: string | undefined

  if (config.env === 'BROWSERBASE' && stagehand.browserbaseSessionID) {
    try {
      const bb = new Browserbase({ apiKey: config.browserbaseApiKey! })
      const debug = await bb.sessions.debug(stagehand.browserbaseSessionID)
      liveViewUrl = debug.debuggerFullscreenUrl
    } catch {
      // Non-fatal — live view is optional
    }
  } else if (config.env === 'LOCAL') {
    // Local live view served by NestJS WebSocket relay
    liveViewUrl = `ws://localhost:${process.env.API_PORT ?? 3001}/sessions/${config.runId}/stream`
  }

  // ── Screencast for LOCAL env ─────────────────────────────────────────────
  // For BROWSERBASE, screencast is handled by their platform
  // For LOCAL, we stream frames via the onFrame callback

  const page = stagehand.context.pages()[0]

  if (config.env === 'LOCAL' && config.onFrame) {
    await page.screencast.start({
      size: { width: 1280, height: 720 },
      onFrame: async (data: Buffer) => {
        await config.onFrame!(data.toString('base64'))
      },
    })
  }

  try {
    await page.goto(config.startUrl, { waitUntil: 'domcontentloaded' })

    // ── Execute steps ──────────────────────────────────────────────────────

    const steps = [...config.steps].sort((a, b) => a.stepIndex - b.stepIndex)

    for (const step of steps) {
      const stepStart = Date.now()

      let actResult: Awaited<ReturnType<typeof stagehand.act>>

      try {
        actResult = await stagehand.act(step.instruction, {
          // Variables are substituted but NOT sent to the LLM
          ...(step.variables && { variables: step.variables }),
        })
      } catch (err) {
        const log: StepLog = {
          stepIndex: step.stepIndex,
          testStepId: step.id,
          instruction: step.instruction,
          description: step.description,
          result: 'FAILED',
          durationMs: Date.now() - stepStart,
          errorMessage: String(err),
        }
        stepLogs.push(log)
        await config.onStepComplete?.(log)

        // Stop on first failure
        if (config.env === 'LOCAL') {
          await page.screencast.stop().catch(() => {})
        }
        await stagehand.close()
        return {
          runId: config.runId,
          status: 'FAILED',
          stepLogs,
          metrics: buildMetrics(stepLogs, await safeGetMetrics(stagehand)),
          liveViewUrl,
          errorMessage: `Step ${step.stepIndex + 1} failed: ${String(err)}`,
          totalDurationMs: Date.now() - startedAt,
        }
      }

      const log: StepLog = {
        stepIndex: step.stepIndex,
        testStepId: step.id,
        instruction: step.instruction,
        description: step.description,
        result: actResult.success ? 'PASSED' : 'FAILED',
        cacheStatus: actResult.cacheStatus,
        durationMs: Date.now() - stepStart,
        errorMessage: actResult.success ? undefined : actResult.message,
      }

      stepLogs.push(log)
      await config.onStepComplete?.(log)

      if (!actResult.success) {
        if (config.env === 'LOCAL') {
          await page.screencast.stop().catch(() => {})
        }
        await stagehand.close()
        return {
          runId: config.runId,
          status: 'FAILED',
          stepLogs,
          metrics: buildMetrics(stepLogs, await safeGetMetrics(stagehand)),
          liveViewUrl,
          errorMessage: `Step ${step.stepIndex + 1} failed: ${actResult.message}`,
          totalDurationMs: Date.now() - startedAt,
        }
      }
    }

    // ── All steps passed ──────────────────────────────────────────────────

    if (config.env === 'LOCAL') {
      await page.screencast.stop().catch(() => {})
    }

    const rawMetrics = await safeGetMetrics(stagehand)
    await stagehand.close()

    return {
      runId: config.runId,
      status: 'PASSED',
      stepLogs,
      metrics: buildMetrics(stepLogs, rawMetrics),
      liveViewUrl,
      totalDurationMs: Date.now() - startedAt,
    }

  } catch (err) {
    if (config.env === 'LOCAL') {
      await page.screencast.stop().catch(() => {})
    }
    await stagehand.close().catch(() => {})

    return {
      runId: config.runId,
      status: 'FAILED',
      stepLogs,
      metrics: { totalTokens: 0, inferenceTimeMs: 0, cacheHits: 0, cacheMisses: 0 },
      liveViewUrl,
      errorMessage: String(err),
      totalDurationMs: Date.now() - startedAt,
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeGetMetrics(stagehand: Stagehand): Promise<any> {
  try { return await stagehand.metrics } catch { return null }
}

function buildMetrics(stepLogs: StepLog[], rawMetrics: any): RunMetrics {
  return {
    totalTokens: rawMetrics
      ? (rawMetrics.totalPromptTokens ?? 0) + (rawMetrics.totalCompletionTokens ?? 0)
      : 0,
    inferenceTimeMs: rawMetrics?.totalInferenceTimeMs ?? 0,
    cacheHits: stepLogs.filter((s) => s.cacheStatus === 'HIT').length,
    cacheMisses: stepLogs.filter((s) => s.cacheStatus === 'MISS').length,
  }
}
```

**`packages/agent/src/index.ts`**
```typescript
export { runTest } from './agent'
export type {
  RunConfig, RunResult, AgentStep, StepLog,
  StepResult, RunStatus, BrowserEnv, CacheStatus, RunMetrics,
} from './types'
```

---

## Step 3 — Update `apps/api`

### Replace `@iris/runner` with `@iris/agent`

In `apps/api/package.json`, replace:
```json
"@iris/runner": "workspace:*"
```
with:
```json
"@iris/agent": "workspace:*"
```

Add new env vars to `apps/api/.env`:
```bash
# Browser environment — LOCAL for dev, BROWSERBASE for production
BROWSER_ENV=LOCAL

# Gemini (required)
GEMINI_API_KEY=your_key_from_aistudio.google.com

# Browserbase (only needed when BROWSER_ENV=BROWSERBASE)
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=

# For local screencast relay
API_PORT=3001
```

### Update DTOs

**`apps/api/src/tests/dto/upsert-steps.dto.ts`**
```typescript
export class AgentStepDto {
  stepIndex: number
  instruction: string        // plain English — what the agent should do
  description?: string       // optional human-readable label
  variables?: Record<string, string>  // sensitive values, not sent to LLM
}

export class UpsertStepsDto {
  steps: AgentStepDto[]
}
```

### Update `tests.service.ts` — upsertSteps method

Replace the `upsertSteps` method body:
```typescript
async upsertSteps(testId: string, userId: string, dto: UpsertStepsDto) {
  await this.getTestAndVerify(testId, userId, true)

  await prisma.$transaction([
    prisma.testStep.deleteMany({ where: { testId } }),
    prisma.testStep.createMany({
      data: dto.steps.map((s) => ({
        testId,
        stepIndex: s.stepIndex,
        instruction: s.instruction,
        description: s.description,
        variables: s.variables ?? {},
      })),
    }),
  ])

  return prisma.testStep.findMany({
    where: { testId },
    orderBy: { stepIndex: 'asc' },
  })
}
```

### Update `queue/test-run.processor.ts`

Replace the entire file:

```typescript
import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { runTest, StepLog } from '@iris/agent'
import { prisma } from '../prisma/prisma'
import { RUN_QUEUE, RunJobPayload } from './queue.constants'

@Processor(RUN_QUEUE)
export class TestRunProcessor {
  private readonly logger = new Logger(TestRunProcessor.name)

  constructor(private eventEmitter: EventEmitter2) {}

  @Process({ name: 'execute', concurrency: 3 })
  async handleRun(job: Job<RunJobPayload>): Promise<void> {
    const { runId, testId, prerequisiteRunIds = [] } = job.data
    this.logger.log(`Processing run ${runId}`)

    // ── Check prerequisites ────────────────────────────────────────────────
    if (prerequisiteRunIds.length > 0) {
      const prereqRuns = await prisma.testRun.findMany({
        where: { id: { in: prerequisiteRunIds } },
        select: { id: true, status: true, test: { select: { name: true } } },
      })

      const failed = prereqRuns.filter((r) => r.status !== 'PASSED')
      if (failed.length > 0) {
        const names = failed.map((r) => `"${r.test.name}"`).join(', ')
        await this.failRun(runId, `Prerequisite test(s) did not pass: ${names}`)
        return
      }
    }

    // ── Fetch test ─────────────────────────────────────────────────────────
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        project: true,
      },
    })

    if (!test) { await this.failRun(runId, `Test ${testId} not found`); return }
    if (test.steps.length === 0) { await this.failRun(runId, 'Test has no steps'); return }

    // ── Mark RUNNING + emit liveViewUrl placeholder ────────────────────────
    const env = (process.env.BROWSER_ENV ?? 'LOCAL') as 'LOCAL' | 'BROWSERBASE'

    await prisma.testRun.update({
      where: { id: runId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        browserEnv: env,
        // For LOCAL, we know the WS URL immediately
        liveViewUrl: env === 'LOCAL'
          ? `ws://localhost:${process.env.API_PORT ?? 3001}/sessions/${runId}/stream`
          : undefined,
      },
    })

    this.eventEmitter.emit(`run.${runId}.started`, {
      runId,
      liveViewUrl: env === 'LOCAL'
        ? `ws://localhost:${process.env.API_PORT ?? 3001}/sessions/${runId}/stream`
        : null,
    })

    // ── Run the agent ──────────────────────────────────────────────────────
    const result = await runTest({
      runId,
      testId,
      startUrl: test.startUrl ?? test.project.baseUrl,
      steps: test.steps.map((s) => ({
        id: s.id,
        stepIndex: s.stepIndex,
        instruction: s.instruction,
        description: s.description ?? undefined,
        variables: s.variables as Record<string, string> | undefined,
      })),
      env,
      geminiApiKey: process.env.GEMINI_API_KEY!,
      browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
      browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,

      onStepComplete: async (log: StepLog) => {
        await prisma.testRunStep.create({
          data: {
            runId,
            stepIndex: log.stepIndex,
            testStepId: log.testStepId,
            instruction: log.instruction,
            description: log.description,
            result: log.result as any,
            cacheStatus: log.cacheStatus,
            durationMs: log.durationMs,
            errorMessage: log.errorMessage,
          },
        })
        this.eventEmitter.emit(`run.${runId}.step`, { runId, step: log })
      },

      // LOCAL screencast relay — publish frames to EventEmitter
      // The WebSocket gateway subscribes and forwards to the frontend canvas
      ...(env === 'LOCAL' && {
        onFrame: async (frameBase64: string) => {
          this.eventEmitter.emit(`run.${runId}.frame`, { frameBase64 })
        },
      }),
    })

    // ── Persist final state ────────────────────────────────────────────────
    await prisma.testRun.update({
      where: { id: runId },
      data: {
        status: result.status as any,
        finishedAt: new Date(),
        errorMessage: result.errorMessage,
        totalSteps: result.stepLogs.length,
        passedSteps: result.stepLogs.filter((s) => s.result === 'PASSED').length,
        liveViewUrl: result.liveViewUrl,
        totalTokens: result.metrics.totalTokens,
        inferenceTimeMs: result.metrics.inferenceTimeMs,
        cacheHits: result.metrics.cacheHits,
      },
    })

    this.eventEmitter.emit(`run.${runId}.completed`, { runId, result })
    this.logger.log(`Run ${runId}: ${result.status}`)
  }

  private async failRun(runId: string, message: string): Promise<void> {
    await prisma.testRun.update({
      where: { id: runId },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: message },
    })
    this.eventEmitter.emit(`run.${runId}.completed`, {
      runId,
      result: { status: 'FAILED', errorMessage: message },
    })
  }
}
```

### Add Session Gateway for LOCAL live view

This relays the `onFrame` events from the processor to WebSocket clients.

**`apps/api/src/sessions/session.gateway.ts`**
```typescript
import {
  WebSocketGateway, WebSocketServer,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { OnEvent } from '@nestjs/event-emitter'

@WebSocketGateway({ cors: true, namespace: '/sessions' })
export class SessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server

  handleConnection(client: Socket) {
    const runId = client.handshake.query.runId as string
    if (!runId) return client.disconnect()
    client.join(`run:${runId}`)
  }

  handleDisconnect(_client: Socket) {}

  // Relay frame events to all clients watching this run
  @OnEvent('run.*.frame')
  handleFrame(payload: { frameBase64: string }, context: string) {
    // Extract runId from event name "run.{runId}.frame"
    const runId = context?.split('.')?.[1]
    if (runId) {
      this.server.to(`run:${runId}`).emit('frame', payload)
    }
  }

  @OnEvent('run.*.step')
  handleStep(payload: any, context: string) {
    const runId = context?.split('.')?.[1]
    if (runId) {
      this.server.to(`run:${runId}`).emit('event', {
        type: 'step.completed',
        ...payload,
      })
    }
  }

  @OnEvent('run.*.started')
  handleStarted(payload: any, context: string) {
    const runId = context?.split('.')?.[1]
    if (runId) {
      this.server.to(`run:${runId}`).emit('event', {
        type: 'run.started',
        ...payload,
      })
    }
  }

  @OnEvent('run.*.completed')
  handleCompleted(payload: any, context: string) {
    const runId = context?.split('.')?.[1]
    if (runId) {
      this.server.to(`run:${runId}`).emit('event', {
        type: 'run.completed',
        ...payload,
      })
    }
  }
}
```

**`apps/api/src/sessions/session.module.ts`**
```typescript
import { Module } from '@nestjs/common'
import { SessionGateway } from './session.gateway'

@Module({
  providers: [SessionGateway],
})
export class SessionModule {}
```

Install socket.io:
```bash
pnpm --filter @iris/api add @nestjs/websockets @nestjs/platform-socket.io socket.io
```

### Update AppModule

**`apps/api/src/app.module.ts`**
```typescript
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { ProjectsModule } from './projects/projects.module'
import { TestsModule } from './tests/tests.module'
import { RunsModule } from './runs/runs.module'
import { QueueModule } from './queue/queue.module'
import { SessionModule } from './sessions/session.module'

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: true }),  // wildcard for run.*.frame pattern
    BullModule.forRoot({
      redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
    }),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    TestsModule,
    RunsModule,
    QueueModule,
    SessionModule,
  ],
})
export class AppModule {}
```

> **Important:** `wildcard: true` is required for the `@OnEvent('run.*.frame')` pattern in the gateway.

---

## Step 4 — Frontend Updates

### Update `apps/web/src/lib/types.ts`

Replace test/run types:
```typescript
export type RunStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED'
export type StepResult = 'PASSED' | 'FAILED' | 'SKIPPED'
export type CacheStatus = 'HIT' | 'MISS'

export interface TestStep {
  id: string
  stepIndex: number
  instruction: string     // plain English
  description?: string    // optional label
  variables?: Record<string, string>
  testId: string
  createdAt: string
}

export interface TestRunStep {
  id: string
  stepIndex: number
  instruction: string
  description?: string
  result: StepResult
  cacheStatus?: CacheStatus
  errorMessage?: string
  durationMs: number
  screenshotUrl?: string
  createdAt: string
}

export interface TestRun {
  id: string
  status: RunStatus
  trigger: string
  startedAt?: string
  finishedAt?: string
  errorMessage?: string
  totalSteps: number
  passedSteps: number
  projectRunId?: string
  liveViewUrl?: string
  browserEnv?: string
  totalTokens?: number
  inferenceTimeMs?: number
  cacheHits?: number
  stepResults: TestRunStep[]
  createdAt: string
}
```

### Replace StepEditor

The step editor is now just an instruction input — no selectors, no dropdowns.

**`apps/web/src/components/tests/StepEditor.tsx`**
```typescript
'use client'

import { useState } from 'react'
import { TestStep } from '@/lib/types'

interface LocalStep {
  _key: string
  id?: string
  stepIndex: number
  instruction: string
  description: string
}

interface Props {
  steps: TestStep[]
  onSave: (steps: Omit<LocalStep, '_key'>[]) => Promise<void>
}

export function StepEditor({ steps: initialSteps, onSave }: Props) {
  const [steps, setSteps] = useState<LocalStep[]>(
    initialSteps.map((s) => ({
      _key: s.id,
      id: s.id,
      stepIndex: s.stepIndex,
      instruction: s.instruction,
      description: s.description ?? '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        _key: `new-${Date.now()}`,
        stepIndex: prev.length,
        instruction: '',
        description: '',
      },
    ])
    setDirty(true)
  }

  function update(key: string, patch: Partial<LocalStep>) {
    setSteps((prev) =>
      prev.map((s) => s._key === key ? { ...s, ...patch } : s)
    )
    setDirty(true)
  }

  function remove(key: string) {
    setSteps((prev) =>
      prev
        .filter((s) => s._key !== key)
        .map((s, i) => ({ ...s, stepIndex: i }))
    )
    setDirty(true)
  }

  function move(key: string, dir: 'up' | 'down') {
    const idx = steps.findIndex((s) => s._key === key)
    if (idx === -1) return
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === steps.length - 1) return
    const next = [...steps]
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]]
    setSteps(next.map((s, i) => ({ ...s, stepIndex: i })))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(steps.map(({ _key, ...s }) => s))
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {dirty && (
        <div className="flex items-center justify-between bg-blue-50 border
                        border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-700">Unsaved changes</p>
          <button onClick={save} disabled={saving}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium
                       rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save steps'}
          </button>
        </div>
      )}

      {/* Hint */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <p className="text-sm text-gray-600">
          Write each step as a plain English instruction for the AI agent.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Examples: "Click the Sign In button" · "Fill email with test@example.com" ·
          "Verify the dashboard heading is visible"
        </p>
      </div>

      {steps.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed
                        border-gray-300">
          <p className="text-4xl mb-3">🤖</p>
          <p className="text-gray-500 text-sm mb-1 font-medium">No steps yet</p>
          <p className="text-gray-400 text-xs mb-5">
            Describe what the AI agent should do, one step at a time
          </p>
          <button onClick={addStep}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                       rounded-lg hover:bg-blue-700 transition-colors">
            + Add first step
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {steps.map((step, idx) => (
              <div key={step._key}
                className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  {/* Step number */}
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center
                                  justify-center text-xs font-mono text-gray-500
                                  shrink-0 mt-2">
                    {idx + 1}
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* Optional label */}
                    <input
                      value={step.description}
                      onChange={(e) => update(step._key, { description: e.target.value })}
                      placeholder="Step label (optional)"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg
                                 text-sm text-gray-500 focus:outline-none
                                 focus:ring-2 focus:ring-blue-500"
                    />
                    {/* Instruction */}
                    <textarea
                      value={step.instruction}
                      onChange={(e) => update(step._key, { instruction: e.target.value })}
                      placeholder='e.g. "Click the blue Sign In button in the top right"'
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg
                                 text-sm focus:outline-none focus:ring-2
                                 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Controls */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => move(step._key, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 text-gray-300 hover:text-gray-600
                                 disabled:opacity-20 transition-colors text-xs">▲</button>
                    <button onClick={() => move(step._key, 'down')}
                      disabled={idx === steps.length - 1}
                      className="p-1.5 text-gray-300 hover:text-gray-600
                                 disabled:opacity-20 transition-colors text-xs">▼</button>
                    <button onClick={() => remove(step._key)}
                      className="p-1.5 text-gray-300 hover:text-red-500
                                 transition-colors text-xs">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={addStep}
            className="w-full py-2.5 border border-dashed border-gray-300
                       rounded-xl text-sm text-gray-400 hover:border-blue-400
                       hover:text-blue-500 transition-colors">
            + Add step
          </button>
        </>
      )}
    </div>
  )
}
```

### Update Run Page — live view + cache badges

**`apps/web/src/app/runs/[id]/page.tsx`**
```typescript
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { io } from 'socket.io-client'
import { api } from '@/lib/api'
import { TestRun, TestRunStep } from '@/lib/types'

const STATUS_STYLES = {
  QUEUED:    'bg-yellow-50 text-yellow-700',
  RUNNING:   'bg-blue-50 text-blue-700',
  PASSED:    'bg-green-50 text-green-700',
  FAILED:    'bg-red-50 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
} as const

const RESULT_ICON = { PASSED: '✅', FAILED: '❌', SKIPPED: '⏭️' } as const

export default function RunPage() {
  const { id: runId } = useParams<{ id: string }>()
  const [run, setRun] = useState<TestRun | null>(null)
  const [steps, setSteps] = useState<TestRunStep[]>([])
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Initial fetch
  useEffect(() => {
    api.get<TestRun>(`/runs/${runId}`).then((data) => {
      setRun(data)
      setSteps(data.stepResults ?? [])
      if (data.liveViewUrl) setLiveViewUrl(data.liveViewUrl)
    }).finally(() => setLoading(false))
  }, [runId])

  // Socket.io for live updates
  useEffect(() => {
    if (!run) return
    if (!['QUEUED', 'RUNNING'].includes(run.status)) return

    const socket = io(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/sessions`,
      { query: { runId }, withCredentials: true }
    )

    // Render screencast frames to canvas (LOCAL only)
    socket.on('frame', ({ frameBase64 }: { frameBase64: string }) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const img = new Image()
      img.onload = () => ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = `data:image/jpeg;base64,${frameBase64}`
    })

    socket.on('event', (event: any) => {
      switch (event.type) {
        case 'run.started':
          if (event.liveViewUrl) setLiveViewUrl(event.liveViewUrl)
          break
        case 'step.completed':
          setSteps((prev) => [...prev, event.step])
          break
        case 'run.completed':
          setRun((prev) => prev
            ? { ...prev, status: event.result.status, errorMessage: event.result.errorMessage }
            : prev
          )
          // Re-fetch to get final metrics + liveViewUrl
          api.get<TestRun>(`/runs/${runId}`).then((data) => {
            setRun(data)
            if (data.liveViewUrl) setLiveViewUrl(data.liveViewUrl)
          })
          socket.disconnect()
          break
      }
    })

    return () => { socket.disconnect() }
  }, [run?.status, runId])

  if (loading || !run) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent
                        rounded-full animate-spin" />
      </div>
    )
  }

  const isLive = ['QUEUED', 'RUNNING'].includes(run.status)
  const duration = run.finishedAt
    ? ((new Date(run.finishedAt).getTime() -
        new Date(run.createdAt).getTime()) / 1000).toFixed(1)
    : null
  const isLocal = run.browserEnv === 'LOCAL' || !run.browserEnv

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
              ← Back
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-mono text-gray-500">
              {runId.slice(0, 12)}...
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Live
              </span>
            )}
            <span className={`text-sm px-3 py-1 rounded-full font-medium
                             ${STATUS_STYLES[run.status]}`}>
              {run.status}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary row */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-6">
          <div className="flex items-center gap-6 text-sm text-gray-600 flex-wrap">
            <span>
              <span className="font-medium text-gray-900">{run.passedSteps}</span>
              /{run.totalSteps} steps passed
            </span>
            {duration && (
              <span>
                {duration}s
              </span>
            )}
            {run.totalTokens !== undefined && run.totalTokens > 0 && (
              <span>
                {run.totalTokens.toLocaleString()} tokens
              </span>
            )}
            {run.cacheHits !== undefined && run.totalSteps > 0 && (
              <span>
                {run.cacheHits}/{run.totalSteps} cache hits
              </span>
            )}
            <span className="text-xs text-gray-400">
              {run.browserEnv ?? 'LOCAL'}
            </span>
          </div>
          {run.errorMessage && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {run.errorMessage}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live view */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Browser {isLive && <span className="text-blue-500 font-normal">· live</span>}
            </h3>
            <LiveView
              liveViewUrl={liveViewUrl}
              canvasRef={canvasRef}
              isLocal={isLocal}
              isLive={isLive}
            />
          </div>

          {/* Step list */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Steps ({steps.length})
            </h3>
            <div className="space-y-2">
              {steps.length === 0 && isLive && (
                <div className="text-center py-10 bg-white rounded-xl border
                                border-gray-200">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent
                                  rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Waiting for agent...</p>
                </div>
              )}
              {steps.map((step) => (
                <div key={`${step.stepIndex}-${step.id}`}
                  className={`bg-white rounded-xl border px-4 py-3 ${
                    step.result === 'FAILED' ? 'border-red-200' : 'border-gray-200'
                  }`}>
                  <div className="flex items-start gap-3">
                    <span className="text-base shrink-0 mt-0.5">
                      {RESULT_ICON[step.result]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 font-mono shrink-0">
                          {step.stepIndex + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {step.description || step.instruction}
                        </span>
                        {step.cacheStatus && (
                          <CacheBadge status={step.cacheStatus} />
                        )}
                      </div>
                      {step.description && (
                        <p className="text-xs text-gray-400 truncate">
                          {step.instruction}
                        </p>
                      )}
                      {step.errorMessage && (
                        <p className="text-xs text-red-500 mt-1 bg-red-50
                                      px-2 py-1 rounded">
                          {step.errorMessage}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {step.durationMs}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function LiveView({
  liveViewUrl, canvasRef, isLocal, isLive,
}: {
  liveViewUrl: string | null
  canvasRef: React.RefObject<HTMLCanvasElement>
  isLocal: boolean
  isLive: boolean
}) {
  if (!liveViewUrl && isLive) {
    return (
      <div className="aspect-video bg-gray-100 rounded-xl flex items-center
                      justify-center">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent
                          rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-400">Connecting to browser...</p>
        </div>
      </div>
    )
  }

  if (!liveViewUrl) {
    return (
      <div className="aspect-video bg-gray-50 rounded-xl border border-gray-200
                      flex items-center justify-center">
        <p className="text-sm text-gray-400">No live view available</p>
      </div>
    )
  }

  // BROWSERBASE — iframe
  if (liveViewUrl.startsWith('https://')) {
    return (
      <iframe
        src={liveViewUrl}
        className="w-full aspect-video rounded-xl border border-gray-200 bg-black"
        sandbox="allow-same-origin allow-scripts"
      />
    )
  }

  // LOCAL — canvas (WebSocket frames)
  return (
    <canvas
      ref={canvasRef}
      width={1280}
      height={720}
      className="w-full aspect-video rounded-xl border border-gray-200 bg-black"
    />
  )
}

function CacheBadge({ status }: { status: 'HIT' | 'MISS' }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
      status === 'HIT'
        ? 'bg-green-50 text-green-700'
        : 'bg-purple-50 text-purple-700'
    }`}>
      {status === 'HIT' ? 'cached' : 'AI'}
    </span>
  )
}
```

Install socket.io-client in web:
```bash
pnpm --filter @iris/web add socket.io-client
```

---

## Step 5 — Docker Compose Update

No changes needed if Redis is already there.
Add to `.env` files as noted above.

---

## Acceptance Criteria

**Agent**
- [ ] `BROWSER_ENV=LOCAL` uses local Chromium via Stagehand
- [ ] `BROWSER_ENV=BROWSERBASE` uses cloud browser via Browserbase SDK
- [ ] `stagehand.act(instruction)` executes each step
- [ ] Failed step stops execution immediately
- [ ] `cacheStatus` is captured per step (HIT = no LLM cost, MISS = LLM used)
- [ ] `selfHeal: true` retries transient failures automatically
- [ ] `runTest()` returns `metrics` (tokens, inference time, cache hits)

**Schema**
- [ ] `TestStep` has `instruction` not `action`/`selector`/`selectorType`
- [ ] `TestRunStep` has `instruction` and `cacheStatus`
- [ ] `TestRun` has `liveViewUrl`, `browserEnv`, `totalTokens`, `cacheHits`

**Live view**
- [ ] LOCAL: canvas renders CDP screencast frames via WebSocket
- [ ] BROWSERBASE: iframe embeds Browserbase debugger URL
- [ ] `run.started` event delivers `liveViewUrl` to frontend immediately
- [ ] Frames stop when run completes

**UI**
- [ ] Step editor shows instruction textarea only (no selector/action dropdowns)
- [ ] Run page shows live browser on the left, step list on the right
- [ ] Cache badge shows "cached" (green) or "AI" (purple) per step
- [ ] Metrics row shows tokens used and cache hits

---

## Tips for Claude Code

1. **`EventEmitterModule.forRoot({ wildcard: true })`** is required for
   `@OnEvent('run.*.frame')` pattern matching. Without it, wildcard events
   don't fire.

2. **Stagehand `variables`** — if a step instruction contains `{{password}}`,
   Stagehand substitutes the value from `variables` before sending to the LLM.
   The actual value never appears in the prompt. Use this for credentials.

3. **`page.screencast` is a Playwright feature** — verify it exists in the
   Playwright version you're using. It was added in Playwright 1.49.
   Check with: `pnpm --filter @iris/agent exec playwright --version`

4. **Socket.io gateway wildcard events** — the `context` parameter in
   `@OnEvent` handlers receives the full event name string. Split on `.`
   to extract the runId: `'run.abc123.frame'.split('.')[1]` = `'abc123'`.

5. **Local screencast timing** — Stagehand takes a moment to launch the browser
   before `page.screencast.start()` can be called. The `await stagehand.init()`
   call blocks until the browser is ready, so calling `screencast.start()` right
   after `init()` is safe.

6. **Test with a simple instruction first:**
   - Start URL: `https://example.com`
   - Step 1: `"Verify the page heading says Example Domain"`
   - This should pass in under 10 seconds with 1 LLM call (MISS on first run,
     HIT on second if serverCache is enabled)