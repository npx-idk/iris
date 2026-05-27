# Iris — Phase 3: Tests, Steps, Prerequisites & Deterministic Runner

## Data Model

```
Project
  └── Test  (ordered within project via `order` field)
        ├── prerequisites: Test[]  (other Tests that must pass first)
        └── TestStep  (ordered within test via `stepIndex`)

Run scope:
  - Single test run  → runs prerequisites first, then the test
  - Project run      → runs all tests in order, respecting prerequisites
```

## Schema

Add to `packages/database/prisma/schema.prisma` after the projects section:

```prisma
// ─── Tests ────────────────────────────────────────────────────────────────────

enum StepAction {
  NAVIGATE
  CLICK
  FILL
  SELECT
  CHECK
  HOVER
  PRESS_KEY
  WAIT
  ASSERT_TEXT
  ASSERT_VISIBLE
  ASSERT_URL
  SCROLL
}

enum SelectorType {
  CSS
  XPATH
}

model Test {
  id          String   @id @default(cuid())
  name        String
  description String?
  startUrl    String?  // overrides project.baseUrl if set
  order       Int      @default(0)  // position within project (reorderable)
  enabled     Boolean  @default(true)
  tags        String[] @default([])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  steps       TestStep[]
  runs        TestRun[]

  // Prerequisites — self-relation (many-to-many)
  // "this test requires these tests to pass first"
  prerequisites     Test[] @relation("TestPrerequisites")
  // "this test is a prerequisite for these tests"
  prerequisiteOf    Test[] @relation("TestPrerequisites")

  @@map("tests")
}

model TestStep {
  id           String       @id @default(cuid())
  stepIndex    Int
  description  String?
  action       StepAction
  selector     String?
  selectorType SelectorType @default(CSS)
  value        String?
  waitBefore   Int          @default(0)
  timeoutMs    Int          @default(10000)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  testId       String
  test         Test         @relation(fields: [testId], references: [id], onDelete: Cascade)

  stepResults  TestRunStep[]

  @@unique([testId, stepIndex])
  @@map("test_steps")
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

enum RunStatus {
  QUEUED
  RUNNING
  PASSED
  FAILED
  CANCELLED
}

enum RunTrigger {
  MANUAL
  SCHEDULE
  API
}

// A TestRun represents a single execution of one Test
// For project runs, multiple TestRuns are created — one per test
model TestRun {
  id           String     @id @default(cuid())
  status       RunStatus  @default(QUEUED)
  trigger      RunTrigger @default(MANUAL)
  startedAt    DateTime?
  finishedAt   DateTime?
  errorMessage String?
  totalSteps   Int        @default(0)
  passedSteps  Int        @default(0)
  metadata     Json?

  // If part of a project run, share the same projectRunId
  projectRunId String?

  createdAt    DateTime   @default(now())

  testId       String
  test         Test       @relation(fields: [testId], references: [id], onDelete: Cascade)

  stepResults  TestRunStep[]

  @@map("test_runs")
}

enum StepResult {
  PASSED
  FAILED
  SKIPPED
}

model TestRunStep {
  id           String        @id @default(cuid())
  stepIndex    Int
  description  String?
  action       StepAction
  selector     String?
  selectorType SelectorType?
  value        String?
  result       StepResult
  errorMessage String?
  durationMs   Int           @default(0)
  screenshotUrl String?
  createdAt    DateTime      @default(now())

  runId        String
  run          TestRun       @relation(fields: [runId], references: [id], onDelete: Cascade)

  testStepId   String?
  testStep     TestStep?     @relation(fields: [testStepId], references: [id], onDelete: SetNull)

  @@map("test_run_steps")
}
```

Add back-relation to `Project`:
```prisma
model Project {
  // ... existing fields ...
  tests Test[]
}
```

Then:
```bash
pnpm db:generate
pnpm db:migrate
# migration name: add_tests_and_runs
```

---

## Step 2 — `packages/runner`

Pure Playwright executor. No AI, no NestJS, no database.

```bash
mkdir -p packages/runner/src
```

**`packages/runner/package.json`**
```json
{
  "name": "@iris/runner",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "playwright": "^1.49.1"
  },
  "devDependencies": {
    "@iris/typescript-config": "workspace:*",
    "@types/node": "^22.0.0",
    "typescript": "5.9.3"
  }
}
```

**`packages/runner/tsconfig.json`**
```json
{
  "extends": "@iris/typescript-config/base.json",
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

**`packages/runner/src/types.ts`**
```typescript
export type StepAction =
  | 'NAVIGATE' | 'CLICK' | 'FILL' | 'SELECT' | 'CHECK'
  | 'HOVER' | 'PRESS_KEY' | 'WAIT' | 'ASSERT_TEXT'
  | 'ASSERT_VISIBLE' | 'ASSERT_URL' | 'SCROLL'

export type SelectorType = 'CSS' | 'XPATH'
export type StepResult = 'PASSED' | 'FAILED' | 'SKIPPED'
export type RunStatus = 'PASSED' | 'FAILED' | 'CANCELLED'

export interface RunStep {
  id: string
  stepIndex: number
  description?: string
  action: StepAction
  selector?: string
  selectorType?: SelectorType
  value?: string
  waitBefore?: number
  timeoutMs?: number
}

export interface StepLog {
  stepIndex: number
  testStepId: string
  description?: string
  action: StepAction
  selector?: string
  selectorType?: SelectorType
  value?: string
  result: StepResult
  errorMessage?: string
  durationMs: number
}

export interface RunConfig {
  runId: string
  testId: string
  startUrl: string
  steps: RunStep[]
  onStepComplete?: (log: StepLog) => void | Promise<void>
}

export interface RunResult {
  runId: string
  status: RunStatus
  stepLogs: StepLog[]
  errorMessage?: string
  totalDurationMs: number
}
```

**`packages/runner/src/executor.ts`**
```typescript
import { Page } from 'playwright'
import { RunStep, StepLog } from './types'

export async function executeStep(
  page: Page,
  step: RunStep,
): Promise<Omit<StepLog, 'durationMs'>> {
  const base = {
    stepIndex: step.stepIndex,
    testStepId: step.id,
    description: step.description,
    action: step.action,
    selector: step.selector,
    selectorType: step.selectorType,
    value: step.value,
  }

  if (step.waitBefore && step.waitBefore > 0) {
    await page.waitForTimeout(step.waitBefore)
  }

  const timeout = step.timeoutMs ?? 10_000

  try {
    switch (step.action) {

      case 'NAVIGATE': {
        if (!step.value) throw new Error('NAVIGATE requires a value (URL)')
        await page.goto(step.value, { waitUntil: 'domcontentloaded', timeout })
        break
      }

      case 'CLICK': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        await loc.click({ timeout })
        break
      }

      case 'FILL': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        await loc.fill(step.value ?? '', { timeout })
        break
      }

      case 'SELECT': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        await loc.selectOption(step.value ?? '', { timeout })
        break
      }

      case 'CHECK': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        const checked = await loc.isChecked()
        if (step.value === 'false') {
          if (checked) await loc.uncheck({ timeout })
        } else {
          if (!checked) await loc.check({ timeout })
        }
        break
      }

      case 'HOVER': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        await loc.hover({ timeout })
        break
      }

      case 'PRESS_KEY': {
        if (step.selector) {
          await getLocator(page, step).press(step.value ?? 'Enter', { timeout })
        } else {
          await page.keyboard.press(step.value ?? 'Enter')
        }
        break
      }

      case 'WAIT': {
        const ms = Math.min(parseInt(step.value ?? '1000', 10), 30_000)
        await page.waitForTimeout(ms)
        break
      }

      case 'ASSERT_TEXT': {
        if (!step.value) throw new Error('ASSERT_TEXT requires a value')
        await page.getByText(step.value).first().waitFor({ state: 'visible', timeout })
        break
      }

      case 'ASSERT_VISIBLE': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        if (!await loc.isVisible()) {
          throw new Error(`Element not visible: ${step.selector}`)
        }
        break
      }

      case 'ASSERT_URL': {
        const current = page.url()
        const expected = step.value ?? ''
        if (!current.includes(expected) && !new RegExp(expected).test(current)) {
          throw new Error(`URL mismatch — expected "${expected}", got "${current}"`)
        }
        break
      }

      case 'SCROLL': {
        if (step.selector) {
          await getLocator(page, step).scrollIntoViewIfNeeded({ timeout })
        } else {
          const dir = step.value ?? 'down'
          await page.evaluate((d) => window.scrollBy(0, d === 'down' ? 500 : -500), dir)
        }
        break
      }

      default:
        throw new Error(`Unknown action: ${step.action}`)
    }

    return { ...base, result: 'PASSED' }
  } catch (err) {
    return {
      ...base,
      result: 'FAILED',
      errorMessage: err instanceof Error ? err.message : String(err),
    }
  }
}

function getLocator(page: Page, step: RunStep) {
  if (!step.selector) {
    throw new Error(`Step ${step.stepIndex} (${step.action}) requires a selector`)
  }
  return step.selectorType === 'XPATH'
    ? page.locator(`xpath=${step.selector}`)
    : page.locator(step.selector)
}
```

**`packages/runner/src/runner.ts`**
```typescript
import { chromium } from 'playwright'
import { executeStep } from './executor'
import { RunConfig, RunResult, StepLog } from './types'

export async function runTest(config: RunConfig): Promise<RunResult> {
  const startedAt = Date.now()
  const stepLogs: StepLog[] = []

  if (config.steps.length === 0) {
    return {
      runId: config.runId,
      status: 'FAILED',
      stepLogs: [],
      errorMessage: 'Test has no steps',
      totalDurationMs: 0,
    }
  }

  const browser = await chromium.launch({ headless: true })

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    })
    const page = await context.newPage()

    await page.goto(config.startUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })

    const steps = [...config.steps].sort((a, b) => a.stepIndex - b.stepIndex)

    for (const step of steps) {
      const stepStart = Date.now()
      const result = await executeStep(page, step)
      const log: StepLog = { ...result, durationMs: Date.now() - stepStart }

      stepLogs.push(log)
      await config.onStepComplete?.(log)

      if (log.result === 'FAILED') {
        return {
          runId: config.runId,
          status: 'FAILED',
          stepLogs,
          errorMessage: `Step ${step.stepIndex + 1} failed: ${log.errorMessage}`,
          totalDurationMs: Date.now() - startedAt,
        }
      }

      await page.waitForTimeout(200)
    }

    return {
      runId: config.runId,
      status: 'PASSED',
      stepLogs,
      totalDurationMs: Date.now() - startedAt,
    }
  } finally {
    await browser.close().catch(() => {})
  }
}
```

**`packages/runner/src/index.ts`**
```typescript
export { runTest } from './runner'
export type {
  RunConfig, RunResult, RunStep, StepLog,
  StepAction, SelectorType, StepResult, RunStatus,
} from './types'
```

Install Playwright browsers after `pnpm install`:
```bash
pnpm --filter @iris/runner exec playwright install chromium
```

---

## Step 3 — Prerequisite Utilities

These utilities live in `apps/api/src/tests/` and handle:
1. **Cycle detection** — prevent circular prerequisites at save time
2. **Execution order** — topological sort for project runs

**`apps/api/src/tests/prerequisite.util.ts`**
```typescript
/**
 * Detect if adding `newPrereqId` as a prerequisite of `testId`
 * would create a cycle in the prerequisite graph.
 *
 * A cycle exists if `testId` is reachable from `newPrereqId`
 * by following prerequisite edges — meaning `testId` is already
 * a (transitive) prerequisite of `newPrereqId`.
 *
 * @param testId        - the test we are adding a prerequisite to
 * @param newPrereqId   - the test we want to add as a prerequisite
 * @param getPrereqs    - async fn returning prerequisite IDs for a given test
 */
export async function wouldCreateCycle(
  testId: string,
  newPrereqId: string,
  getPrereqs: (id: string) => Promise<string[]>,
): Promise<boolean> {
  // If newPrereqId == testId, it's an immediate self-loop
  if (newPrereqId === testId) return true

  // BFS from newPrereqId — if we reach testId, adding newPrereqId
  // as a prereq of testId would create a cycle
  const visited = new Set<string>()
  const queue = [newPrereqId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const prereqs = await getPrereqs(current)

    for (const prereqId of prereqs) {
      if (prereqId === testId) return true  // cycle found
      if (!visited.has(prereqId)) queue.push(prereqId)
    }
  }

  return false
}

/**
 * Topological sort of tests by prerequisites.
 * Returns tests in execution order — prerequisites always before dependents.
 *
 * Uses Kahn's algorithm (BFS-based).
 * Assumes no cycles (validate before calling).
 *
 * @param tests - array of tests with their prerequisite IDs
 */
export function topologicalSort(
  tests: Array<{ id: string; prerequisites: Array<{ id: string }> }>,
): string[] {
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>() // prereqId → tests that depend on it

  for (const test of tests) {
    if (!inDegree.has(test.id)) inDegree.set(test.id, 0)
    if (!dependents.has(test.id)) dependents.set(test.id, [])

    for (const prereq of test.prerequisites) {
      inDegree.set(test.id, (inDegree.get(test.id) ?? 0) + 1)
      if (!dependents.has(prereq.id)) dependents.set(prereq.id, [])
      dependents.get(prereq.id)!.push(test.id)
    }
  }

  // Start with tests that have no prerequisites
  const queue = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id)

  const result: string[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    result.push(id)

    for (const dependentId of dependents.get(id) ?? []) {
      const newDegree = (inDegree.get(dependentId) ?? 0) - 1
      inDegree.set(dependentId, newDegree)
      if (newDegree === 0) queue.push(dependentId)
    }
  }

  return result
}
```

---

## Step 4 — `apps/api` — Tests Module

Install dependencies:
```bash
pnpm --filter @iris/api add @nestjs/bull bull ioredis @nestjs/event-emitter
pnpm --filter @iris/api add -D @types/bull
```

Add to `apps/api/package.json`:
```json
"@iris/runner": "workspace:*"
```

### DTOs

**`apps/api/src/tests/dto/create-test.dto.ts`**
```typescript
export class CreateTestDto {
  name: string
  description?: string
  startUrl?: string
  tags?: string[]
  enabled?: boolean
}
```

**`apps/api/src/tests/dto/update-test.dto.ts`**
```typescript
export class UpdateTestDto {
  name?: string
  description?: string
  startUrl?: string
  tags?: string[]
  enabled?: boolean
}
```

**`apps/api/src/tests/dto/upsert-steps.dto.ts`**
```typescript
export class StepDto {
  stepIndex: number
  description?: string
  action: string
  selector?: string
  selectorType?: string
  value?: string
  waitBefore?: number
  timeoutMs?: number
}

export class UpsertStepsDto {
  steps: StepDto[]
}
```

**`apps/api/src/tests/dto/reorder-tests.dto.ts`**
```typescript
// Array of { id, order } pairs — reorder multiple tests in one call
export class ReorderTestsDto {
  tests: Array<{ id: string; order: number }>
}
```

**`apps/api/src/tests/dto/add-prerequisite.dto.ts`**
```typescript
export class AddPrerequisiteDto {
  prerequisiteId: string  // ID of the test to add as prerequisite
}
```

### Service

**`apps/api/src/tests/tests.service.ts`**
```typescript
import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common'
import { prisma } from '../prisma/prisma'
import { CreateTestDto } from './dto/create-test.dto'
import { UpdateTestDto } from './dto/update-test.dto'
import { UpsertStepsDto } from './dto/upsert-steps.dto'
import { ReorderTestsDto } from './dto/reorder-tests.dto'
import { AddPrerequisiteDto } from './dto/add-prerequisite.dto'
import { wouldCreateCycle } from './prerequisite.util'

@Injectable()
export class TestsService {

  // ─── Access helpers ───────────────────────────────────────────────────────

  private async verifyProjectAccess(projectId: string, userId: string, write = false) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!member) throw new ForbiddenException('Not a project member')
    if (write && member.role === 'VIEWER') {
      throw new ForbiddenException('Viewers cannot modify tests')
    }
    return member
  }

  private async getTestAndVerify(testId: string, userId: string, write = false) {
    const test = await prisma.test.findUnique({ where: { id: testId } })
    if (!test) throw new NotFoundException('Test not found')
    await this.verifyProjectAccess(test.projectId, userId, write)
    return test
  }

  // ─── Tests CRUD ───────────────────────────────────────────────────────────

  async findAll(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId)

    return prisma.test.findMany({
      where: { projectId },
      include: {
        _count: { select: { steps: true, runs: true } },
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
        prerequisites: {
          select: { id: true, name: true },
        },
      },
      orderBy: { order: 'asc' },
    })
  }

  async findOne(testId: string, userId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        prerequisites: { select: { id: true, name: true, order: true } },
        prerequisiteOf: { select: { id: true, name: true } },
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, status: true, totalSteps: true,
            passedSteps: true, createdAt: true, finishedAt: true,
          },
        },
        _count: { select: { runs: true } },
      },
    })

    if (!test) throw new NotFoundException('Test not found')
    await this.verifyProjectAccess(test.projectId, userId)
    return test
  }

  async create(projectId: string, userId: string, dto: CreateTestDto) {
    await this.verifyProjectAccess(projectId, userId, true)

    // Place at end of the list by default
    const maxOrder = await prisma.test.aggregate({
      where: { projectId },
      _max: { order: true },
    })
    const order = (maxOrder._max.order ?? -1) + 1

    return prisma.test.create({
      data: {
        name: dto.name,
        description: dto.description,
        startUrl: dto.startUrl,
        tags: dto.tags ?? [],
        enabled: dto.enabled ?? true,
        order,
        projectId,
      },
    })
  }

  async update(testId: string, userId: string, dto: UpdateTestDto) {
    await this.getTestAndVerify(testId, userId, true)
    return prisma.test.update({ where: { id: testId }, data: dto })
  }

  async remove(testId: string, userId: string) {
    const test = await this.getTestAndVerify(testId, userId, true)

    // Check nothing depends on this test as a prerequisite
    const dependents = await prisma.test.findMany({
      where: { prerequisites: { some: { id: testId } } },
      select: { id: true, name: true },
    })

    if (dependents.length > 0) {
      const names = dependents.map((d) => `"${d.name}"`).join(', ')
      throw new ConflictException(
        `Cannot delete — this test is a prerequisite for: ${names}. ` +
        `Remove those dependencies first.`
      )
    }

    await prisma.test.delete({ where: { id: testId } })
  }

  async duplicate(testId: string, userId: string) {
    const test = await this.findOne(testId, userId)
    await this.verifyProjectAccess(test.projectId, userId, true)

    const maxOrder = await prisma.test.aggregate({
      where: { projectId: test.projectId },
      _max: { order: true },
    })

    return prisma.test.create({
      data: {
        name: `${test.name} (copy)`,
        description: test.description,
        startUrl: test.startUrl,
        tags: test.tags,
        enabled: false,
        order: (maxOrder._max.order ?? 0) + 1,
        projectId: test.projectId,
        steps: {
          create: test.steps.map((s) => ({
            stepIndex: s.stepIndex,
            description: s.description,
            action: s.action,
            selector: s.selector,
            selectorType: s.selectorType,
            value: s.value,
            waitBefore: s.waitBefore,
            timeoutMs: s.timeoutMs,
          })),
        },
        // Note: prerequisites are NOT copied — user adds them explicitly
      },
      include: { steps: { orderBy: { stepIndex: 'asc' } } },
    })
  }

  // ─── Reordering ───────────────────────────────────────────────────────────

  async reorder(projectId: string, userId: string, dto: ReorderTestsDto) {
    await this.verifyProjectAccess(projectId, userId, true)

    // Verify all tests belong to this project
    const testIds = dto.tests.map((t) => t.id)
    const tests = await prisma.test.findMany({
      where: { id: { in: testIds }, projectId },
      select: { id: true },
    })

    if (tests.length !== testIds.length) {
      throw new BadRequestException('One or more tests do not belong to this project')
    }

    // Update all orders in a single transaction
    await prisma.$transaction(
      dto.tests.map(({ id, order }) =>
        prisma.test.update({ where: { id }, data: { order } })
      )
    )

    return this.findAll(projectId, userId)
  }

  // ─── Prerequisites ────────────────────────────────────────────────────────

  async addPrerequisite(testId: string, userId: string, dto: AddPrerequisiteDto) {
    const test = await this.getTestAndVerify(testId, userId, true)
    const { prerequisiteId } = dto

    if (testId === prerequisiteId) {
      throw new BadRequestException('A test cannot be its own prerequisite')
    }

    // Verify prerequisite exists and belongs to same project
    const prereq = await prisma.test.findUnique({
      where: { id: prerequisiteId },
    })
    if (!prereq) throw new NotFoundException('Prerequisite test not found')
    if (prereq.projectId !== test.projectId) {
      throw new BadRequestException('Prerequisites must belong to the same project')
    }

    // Check for existing connection
    const existing = await prisma.test.findFirst({
      where: {
        id: testId,
        prerequisites: { some: { id: prerequisiteId } },
      },
    })
    if (existing) {
      throw new ConflictException('This prerequisite is already added')
    }

    // Cycle detection — would adding prerequisiteId as prereq of testId
    // create a cycle? i.e. is testId already reachable from prerequisiteId?
    const hasCycle = await wouldCreateCycle(
      testId,
      prerequisiteId,
      async (id) => {
        const t = await prisma.test.findUnique({
          where: { id },
          select: { prerequisites: { select: { id: true } } },
        })
        return t?.prerequisites.map((p) => p.id) ?? []
      },
    )

    if (hasCycle) {
      throw new BadRequestException(
        'Cannot add this prerequisite — it would create a circular dependency'
      )
    }

    await prisma.test.update({
      where: { id: testId },
      data: { prerequisites: { connect: { id: prerequisiteId } } },
    })

    return this.findOne(testId, userId)
  }

  async removePrerequisite(testId: string, userId: string, prerequisiteId: string) {
    await this.getTestAndVerify(testId, userId, true)

    await prisma.test.update({
      where: { id: testId },
      data: { prerequisites: { disconnect: { id: prerequisiteId } } },
    })
  }

  // ─── Steps ────────────────────────────────────────────────────────────────

  async upsertSteps(testId: string, userId: string, dto: UpsertStepsDto) {
    await this.getTestAndVerify(testId, userId, true)

    // Full replace in a transaction
    await prisma.$transaction([
      prisma.testStep.deleteMany({ where: { testId } }),
      prisma.testStep.createMany({
        data: dto.steps.map((s) => ({
          testId,
          stepIndex: s.stepIndex,
          description: s.description,
          action: s.action as any,
          selector: s.selector,
          selectorType: (s.selectorType as any) ?? 'CSS',
          value: s.value,
          waitBefore: s.waitBefore ?? 0,
          timeoutMs: s.timeoutMs ?? 10000,
        })),
      }),
    ])

    return prisma.testStep.findMany({
      where: { testId },
      orderBy: { stepIndex: 'asc' },
    })
  }
}
```

### Controller

**`apps/api/src/tests/tests.controller.ts`**
```typescript
import {
  Controller, Get, Post, Patch, Delete, Put,
  Param, Body, UseGuards, HttpCode,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { TestsService } from './tests.service'
import { CreateTestDto } from './dto/create-test.dto'
import { UpdateTestDto } from './dto/update-test.dto'
import { UpsertStepsDto } from './dto/upsert-steps.dto'
import { ReorderTestsDto } from './dto/reorder-tests.dto'
import { AddPrerequisiteDto } from './dto/add-prerequisite.dto'

@UseGuards(AuthGuard)
@Controller()
export class TestsController {
  constructor(private readonly tests: TestsService) {}

  // ─── Tests ────────────────────────────────────────────────────────────────

  @Get('projects/:projectId/tests')
  findAll(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    return this.tests.findAll(projectId, user.id)
  }

  @Post('projects/:projectId/tests')
  create(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestDto,
  ) {
    return this.tests.create(projectId, user.id, dto)
  }

  @Get('tests/:id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tests.findOne(id, user.id)
  }

  @Patch('tests/:id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateTestDto,
  ) {
    return this.tests.update(id, user.id, dto)
  }

  @Delete('tests/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tests.remove(id, user.id)
  }

  @Post('tests/:id/duplicate')
  duplicate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tests.duplicate(id, user.id)
  }

  // ─── Reordering ───────────────────────────────────────────────────────────

  @Patch('projects/:projectId/tests/reorder')
  reorder(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: ReorderTestsDto,
  ) {
    return this.tests.reorder(projectId, user.id, dto)
  }

  // ─── Prerequisites ────────────────────────────────────────────────────────

  @Post('tests/:id/prerequisites')
  addPrerequisite(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AddPrerequisiteDto,
  ) {
    return this.tests.addPrerequisite(id, user.id, dto)
  }

  @Delete('tests/:id/prerequisites/:prerequisiteId')
  @HttpCode(204)
  removePrerequisite(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('prerequisiteId') prerequisiteId: string,
  ) {
    return this.tests.removePrerequisite(id, user.id, prerequisiteId)
  }

  // ─── Steps ────────────────────────────────────────────────────────────────

  @Put('tests/:id/steps')
  upsertSteps(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpsertStepsDto,
  ) {
    return this.tests.upsertSteps(id, user.id, dto)
  }
}
```

**`apps/api/src/tests/tests.module.ts`**
```typescript
import { Module } from '@nestjs/common'
import { TestsController } from './tests.controller'
import { TestsService } from './tests.service'

@Module({
  controllers: [TestsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}
```

---

## Step 5 — Runs Module

The key logic here is prerequisite resolution before running a test.

**`apps/api/src/runs/runs.service.ts`**
```typescript
import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common'
import { prisma } from '../prisma/prisma'
import { QueueService } from '../queue/queue.service'
import { topologicalSort } from '../tests/prerequisite.util'

@Injectable()
export class RunsService {
  constructor(private queue: QueueService) {}

  // ─── Single test run ──────────────────────────────────────────────────────
  // Resolves prerequisites, queues them first, then queues the test

  async triggerTest(testId: string, userId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: { include: { members: true } },
        steps: true,
        prerequisites: {
          include: { steps: true, prerequisites: true },
        },
      },
    })

    if (!test) throw new NotFoundException('Test not found')

    const member = test.project.members.find((m) => m.userId === userId)
    if (!member) throw new ForbiddenException('Not a project member')
    if (member.role === 'VIEWER') throw new ForbiddenException('Viewers cannot trigger runs')
    if (!test.enabled) throw new BadRequestException('Test is disabled')
    if (test.steps.length === 0) throw new BadRequestException('Add steps before running')

    // Shared projectRunId groups all runs triggered together
    const projectRunId = `pr_${Date.now()}`

    // Queue prerequisites first (if any), then the test itself
    const toRun = [...test.prerequisites, test]
    const runIds: string[] = []

    for (const t of toRun) {
      const run = await prisma.testRun.create({
        data: {
          testId: t.id,
          status: 'QUEUED',
          trigger: 'MANUAL',
          projectRunId,
        },
      })
      runIds.push(run.id)
      await this.queue.enqueueRun({
        runId: run.id,
        testId: t.id,
        projectRunId,
        // Mark which run must pass before this one starts
        // The processor checks this before executing
        prerequisiteRunIds: runIds.slice(0, -1),
      })
    }

    // Return the primary run ID (the test itself, last in the list)
    return { runId: runIds[runIds.length - 1], projectRunId }
  }

  // ─── Full project run ─────────────────────────────────────────────────────
  // Runs all enabled tests in topological order

  async triggerProject(projectId: string, userId: string) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!member) throw new ForbiddenException('Not a project member')
    if (member.role === 'VIEWER') throw new ForbiddenException()

    const tests = await prisma.test.findMany({
      where: { projectId, enabled: true },
      include: {
        steps: true,
        prerequisites: { select: { id: true } },
      },
      orderBy: { order: 'asc' },
    })

    if (tests.length === 0) {
      throw new BadRequestException('No enabled tests in this project')
    }

    const projectRunId = `pr_${Date.now()}`

    // Topological sort — prerequisites always execute before dependents
    const sortedIds = topologicalSort(tests)
    const testMap = new Map(tests.map((t) => [t.id, t]))

    // Track runId per testId so we can wire prerequisite chains
    const runIdByTestId = new Map<string, string>()
    const primaryRunIds: string[] = []

    for (const testId of sortedIds) {
      const test = testMap.get(testId)
      if (!test || test.steps.length === 0) continue

      const prerequisiteRunIds = test.prerequisites
        .map((p) => runIdByTestId.get(p.id))
        .filter(Boolean) as string[]

      const run = await prisma.testRun.create({
        data: {
          testId,
          status: 'QUEUED',
          trigger: 'MANUAL',
          projectRunId,
        },
      })

      runIdByTestId.set(testId, run.id)
      primaryRunIds.push(run.id)

      await this.queue.enqueueRun({
        runId: run.id,
        testId,
        projectRunId,
        prerequisiteRunIds,
      })
    }

    return { projectRunId, runIds: primaryRunIds }
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findOne(runId: string, userId: string) {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        stepResults: { orderBy: { stepIndex: 'asc' } },
        test: {
          include: {
            project: { include: { members: true } },
          },
        },
      },
    })

    if (!run) throw new NotFoundException('Run not found')

    const isMember = run.test.project.members.some((m) => m.userId === userId)
    if (!isMember) throw new ForbiddenException()

    return run
  }

  async findAllForTest(testId: string, userId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { project: { include: { members: true } } },
    })
    if (!test) throw new NotFoundException('Test not found')

    const isMember = test.project.members.some((m) => m.userId === userId)
    if (!isMember) throw new ForbiddenException()

    return prisma.testRun.findMany({
      where: { testId },
      include: { stepResults: { orderBy: { stepIndex: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async cancel(runId: string, userId: string) {
    const run = await this.findOne(runId, userId)
    if (!['QUEUED', 'RUNNING'].includes(run.status)) {
      throw new BadRequestException('Only QUEUED or RUNNING runs can be cancelled')
    }
    await prisma.testRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    })
  }
}
```

**`apps/api/src/runs/runs.controller.ts`**
```typescript
import {
  Controller, Get, Post, Param, UseGuards,
  HttpCode, Sse, MessageEvent,
} from '@nestjs/common'
import { Observable, fromEvent, merge, timer } from 'rxjs'
import { map, takeUntil } from 'rxjs/operators'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { RunsService } from './runs.service'

@UseGuards(AuthGuard)
@Controller()
export class RunsController {
  constructor(
    private runs: RunsService,
    private eventEmitter: EventEmitter2,
  ) {}

  // Trigger a single test (with prerequisites)
  @Post('tests/:testId/runs')
  triggerTest(
    @CurrentUser() user: any,
    @Param('testId') testId: string,
  ) {
    return this.runs.triggerTest(testId, user.id)
  }

  // Trigger all tests in a project
  @Post('projects/:projectId/runs')
  triggerProject(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
  ) {
    return this.runs.triggerProject(projectId, user.id)
  }

  @Get('runs/:id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.runs.findOne(id, user.id)
  }

  @Get('tests/:testId/runs')
  findAllForTest(
    @CurrentUser() user: any,
    @Param('testId') testId: string,
  ) {
    return this.runs.findAllForTest(testId, user.id)
  }

  @Post('runs/:id/cancel')
  @HttpCode(204)
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.runs.cancel(id, user.id)
  }

  @Sse('runs/:id/stream')
  stream(@Param('id') runId: string): Observable<MessageEvent> {
    const step$ = fromEvent(this.eventEmitter, `run.${runId}.step`).pipe(
      map((data) => ({ type: 'step', data: JSON.stringify(data) } as MessageEvent)),
    )
    const completed$ = fromEvent(this.eventEmitter, `run.${runId}.completed`)
    const done$ = completed$.pipe(
      map((data) => ({ type: 'completed', data: JSON.stringify(data) } as MessageEvent)),
    )
    const ping$ = timer(0, 15_000).pipe(
      map(() => ({ type: 'ping', data: '{}' } as MessageEvent)),
    )

    return merge(step$, done$, ping$).pipe(takeUntil(completed$))
  }
}
```

**`apps/api/src/runs/runs.module.ts`**
```typescript
import { Module } from '@nestjs/common'
import { RunsController } from './runs.controller'
import { RunsService } from './runs.service'
import { QueueModule } from '../queue/queue.module'

@Module({
  imports: [QueueModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
```

---

## Step 6 — Queue Module

**`apps/api/src/queue/queue.module.ts`**
```typescript
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { QueueService } from './queue.service'
import { TestRunProcessor } from './test-run.processor'

export const RUN_QUEUE = 'iris.runs'

@Module({
  imports: [BullModule.registerQueue({ name: RUN_QUEUE })],
  providers: [QueueService, TestRunProcessor],
  exports: [QueueService],
})
export class QueueModule {}
```

**`apps/api/src/queue/queue.service.ts`**
```typescript
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { RUN_QUEUE } from './queue.module'

export interface RunJobPayload {
  runId: string
  testId: string
  projectRunId?: string
  prerequisiteRunIds?: string[]  // must be PASSED before this job starts
}

@Injectable()
export class QueueService {
  constructor(@InjectQueue(RUN_QUEUE) private runQueue: Queue) {}

  async enqueueRun(payload: RunJobPayload): Promise<void> {
    await this.runQueue.add('execute', payload, {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 200,
    })
  }
}
```

**`apps/api/src/queue/test-run.processor.ts`**
```typescript
import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { runTest } from '@iris/runner'
import { prisma } from '../prisma/prisma'
import { RUN_QUEUE, RunJobPayload } from './queue.module'
import { StepLog } from '@iris/runner'

@Processor(RUN_QUEUE)
export class TestRunProcessor {
  private readonly logger = new Logger(TestRunProcessor.name)

  constructor(private eventEmitter: EventEmitter2) {}

  @Process({ name: 'execute', concurrency: 3 })
  async handleRun(job: Job<RunJobPayload>): Promise<void> {
    const { runId, testId, prerequisiteRunIds = [] } = job.data
    this.logger.log(`Processing run ${runId}`)

    // ── Check prerequisites ────────────────────────────────────────────────
    // If any prerequisite run failed/cancelled, mark this run as FAILED
    if (prerequisiteRunIds.length > 0) {
      const prereqRuns = await prisma.testRun.findMany({
        where: { id: { in: prerequisiteRunIds } },
        select: { id: true, status: true, test: { select: { name: true } } },
      })

      const failed = prereqRuns.filter((r) => r.status !== 'PASSED')

      if (failed.length > 0) {
        const names = failed.map((r) => `"${r.test.name}"`).join(', ')
        await this.failRun(
          runId,
          `Prerequisite test(s) did not pass: ${names}`
        )
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

    if (!test) {
      await this.failRun(runId, `Test ${testId} not found`)
      return
    }

    if (test.steps.length === 0) {
      await this.failRun(runId, 'Test has no steps')
      return
    }

    // ── Mark as RUNNING ────────────────────────────────────────────────────
    await prisma.testRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() },
    })

    this.eventEmitter.emit(`run.${runId}.started`, { runId })

    // ── Execute ────────────────────────────────────────────────────────────
    const result = await runTest({
      runId,
      testId,
      startUrl: test.startUrl ?? test.project.baseUrl,
      steps: test.steps.map((s) => ({
        id: s.id,
        stepIndex: s.stepIndex,
        description: s.description ?? undefined,
        action: s.action as any,
        selector: s.selector ?? undefined,
        selectorType: s.selectorType as any,
        value: s.value ?? undefined,
        waitBefore: s.waitBefore,
        timeoutMs: s.timeoutMs,
      })),
      onStepComplete: async (log: StepLog) => {
        await prisma.testRunStep.create({
          data: {
            runId,
            stepIndex: log.stepIndex,
            testStepId: log.testStepId,
            description: log.description,
            action: log.action as any,
            selector: log.selector,
            selectorType: log.selectorType as any,
            value: log.value,
            result: log.result as any,
            errorMessage: log.errorMessage,
            durationMs: log.durationMs,
          },
        })
        this.eventEmitter.emit(`run.${runId}.step`, { runId, step: log })
      },
    })

    // ── Persist result ─────────────────────────────────────────────────────
    await prisma.testRun.update({
      where: { id: runId },
      data: {
        status: result.status as any,
        finishedAt: new Date(),
        errorMessage: result.errorMessage,
        totalSteps: result.stepLogs.length,
        passedSteps: result.stepLogs.filter((s) => s.result === 'PASSED').length,
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

---

## Step 7 — Update AppModule

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

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
    }),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    TestsModule,
    RunsModule,
    QueueModule,
  ],
})
export class AppModule {}
```

Add Redis to `docker-compose.yml`:
```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
```

Add to `apps/api/.env`:
```
REDIS_URL=redis://localhost:6379
```

---

## Step 8 — Frontend

### Types — add to `apps/web/src/lib/types.ts`

```typescript
export type StepAction =
  | 'NAVIGATE' | 'CLICK' | 'FILL' | 'SELECT' | 'CHECK'
  | 'HOVER' | 'PRESS_KEY' | 'WAIT' | 'ASSERT_TEXT'
  | 'ASSERT_VISIBLE' | 'ASSERT_URL' | 'SCROLL'

export type SelectorType = 'CSS' | 'XPATH'
export type RunStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED'
export type StepResult = 'PASSED' | 'FAILED' | 'SKIPPED'

export interface TestPrerequisite {
  id: string
  name: string
}

export interface Test {
  id: string
  name: string
  description?: string
  startUrl?: string
  enabled: boolean
  order: number
  tags: string[]
  projectId: string
  prerequisites: TestPrerequisite[]
  createdAt: string
  updatedAt: string
  _count?: { steps: number; runs: number }
  runs?: TestRunSummary[]
}

export interface TestWithSteps extends Test {
  steps: TestStep[]
}

export interface TestStep {
  id: string
  stepIndex: number
  description?: string
  action: StepAction
  selector?: string
  selectorType: SelectorType
  value?: string
  waitBefore: number
  timeoutMs: number
  testId: string
}

export interface TestRunSummary {
  id: string
  status: RunStatus
  totalSteps: number
  passedSteps: number
  createdAt: string
  finishedAt?: string
}

export interface TestRun extends TestRunSummary {
  trigger: string
  errorMessage?: string
  projectRunId?: string
  stepResults: TestRunStep[]
}

export interface TestRunStep {
  id: string
  stepIndex: number
  description?: string
  action: StepAction
  selector?: string
  selectorType?: SelectorType
  value?: string
  result: StepResult
  errorMessage?: string
  durationMs: number
  createdAt: string
}
```

### Tests list with drag-to-reorder

**`apps/web/src/app/projects/[id]/tests/page.tsx`**
```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Test } from '@/lib/types'

export default function TestsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<Test[]>(`/projects/${projectId}/tests`)
      .then(setTests)
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { load() }, [load])

  // ── Drag to reorder ────────────────────────────────────────────────────────

  function handleDragStart(id: string) { setDragging(id) }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragging || dragging === targetId) return

    setTests((prev) => {
      const from = prev.findIndex((t) => t.id === dragging)
      const to = prev.findIndex((t) => t.id === targetId)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((t, i) => ({ ...t, order: i }))
    })
  }

  async function handleDragEnd() {
    setDragging(null)
    // Persist the new order
    await api.patch(`/projects/${projectId}/tests/reorder`, {
      tests: tests.map((t) => ({ id: t.id, order: t.order })),
    })
  }

  const lastRunStatus = (test: Test) => test.runs?.[0]?.status

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/projects/${projectId}`}
              className="text-gray-400 hover:text-gray-600 text-sm">
              ← Project
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-900">Tests</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => api.post(`/projects/${projectId}/runs`).then(load)}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm
                         font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              ▶ Run all
            </button>
            <Link href={`/projects/${projectId}/tests/new`}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                         rounded-lg hover:bg-blue-700 transition-colors">
              + New test
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl border
                                      border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🧪</div>
            <h2 className="font-medium text-gray-900 mb-2">No tests yet</h2>
            <p className="text-gray-500 text-sm mb-6">
              Create your first test to start automating
            </p>
            <Link href={`/projects/${projectId}/tests/new`}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                         rounded-lg hover:bg-blue-700 transition-colors">
              Create test
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">
              Drag to reorder · {tests.length} test{tests.length !== 1 ? 's' : ''}
            </p>
            {tests.map((test) => {
              const status = lastRunStatus(test)
              return (
                <div
                  key={test.id}
                  draggable
                  onDragStart={() => handleDragStart(test.id)}
                  onDragOver={(e) => handleDragOver(e, test.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 bg-white rounded-xl border
                              px-4 py-4 cursor-grab active:cursor-grabbing
                              transition-all ${
                    dragging === test.id
                      ? 'opacity-50 border-blue-300'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  {/* Drag handle */}
                  <span className="text-gray-300 select-none text-lg">⠿</span>

                  {/* Status dot */}
                  <StatusDot status={status} />

                  {/* Test info */}
                  <Link href={`/tests/${test.id}`} className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{test.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {test._count?.steps ?? 0} steps
                      {test.prerequisites.length > 0 && (
                        <span className="ml-2">
                          · needs: {test.prerequisites.map((p) => p.name).join(', ')}
                        </span>
                      )}
                    </p>
                  </Link>

                  {/* Tags */}
                  <div className="flex items-center gap-2 shrink-0">
                    {test.tags.slice(0, 3).map((tag) => (
                      <span key={tag}
                        className="text-xs bg-gray-100 text-gray-500
                                   px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                    {!test.enabled && (
                      <span className="text-xs bg-gray-100 text-gray-400
                                       px-2 py-0.5 rounded-full">
                        disabled
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function StatusDot({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    PASSED: 'bg-green-500',
    FAILED: 'bg-red-500',
    RUNNING: 'bg-blue-500 animate-pulse',
    QUEUED: 'bg-yellow-400',
    CANCELLED: 'bg-gray-300',
  }
  return (
    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
      status ? colors[status] : 'bg-gray-200'
    }`} />
  )
}
```

### Test detail page with prerequisites

**`apps/web/src/app/tests/[id]/page.tsx`**
```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { TestWithSteps, TestStep, Test } from '@/lib/types'
import { StepEditor } from '@/components/tests/StepEditor'
import { RunHistory } from '@/components/tests/RunHistory'
import { PrerequisiteManager } from '@/components/tests/PrerequisiteManager'

type Tab = 'steps' | 'prerequisites' | 'runs'

export default function TestDetailPage() {
  const { id: testId } = useParams<{ id: string }>()
  const router = useRouter()
  const [test, setTest] = useState<TestWithSteps | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [tab, setTab] = useState<Tab>('steps')

  const load = useCallback(() => {
    api.get<TestWithSteps>(`/tests/${testId}`)
      .then(setTest)
      .finally(() => setLoading(false))
  }, [testId])

  useEffect(() => { load() }, [load])

  async function handleRun() {
    setRunning(true)
    try {
      const { runId } = await api.post<{ runId: string }>(
        `/tests/${testId}/runs`
      )
      router.push(`/runs/${runId}`)
    } finally {
      setRunning(false)
    }
  }

  if (loading || !test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent
                        rounded-full animate-spin" />
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'steps', label: `Steps (${test.steps.length})` },
    { key: 'prerequisites', label: `Prerequisites (${test.prerequisites.length})` },
    { key: 'runs', label: 'Runs' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/projects/${test.projectId}/tests`}
              className="text-gray-400 hover:text-gray-600 text-sm">
              ← Tests
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-900">{test.name}</span>
            {!test.enabled && (
              <span className="text-xs bg-gray-100 text-gray-400
                               px-2 py-0.5 rounded-full">
                disabled
              </span>
            )}
          </div>
          <button
            onClick={handleRun}
            disabled={running || !test.enabled || test.steps.length === 0}
            title={test.steps.length === 0 ? 'Add steps first' : undefined}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                       rounded-lg hover:bg-blue-700 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Starting...' : '▶ Run test'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 shrink-0">
        <div className="max-w-5xl mx-auto flex gap-6">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        {tab === 'steps' && (
          <StepEditor
            test={test}
            steps={test.steps}
            onSave={async (steps) => {
              await api.put(`/tests/${testId}/steps`, { steps })
              load()
            }}
          />
        )}
        {tab === 'prerequisites' && (
          <PrerequisiteManager
            test={test}
            onUpdate={load}
          />
        )}
        {tab === 'runs' && (
          <RunHistory testId={testId} />
        )}
      </div>
    </div>
  )
}
```

### PrerequisiteManager component

**`apps/web/src/components/tests/PrerequisiteManager.tsx`**
```typescript
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { TestWithSteps, Test } from '@/lib/types'

interface Props {
  test: TestWithSteps
  onUpdate: () => void
}

export function PrerequisiteManager({ test, onUpdate }: Props) {
  const [allTests, setAllTests] = useState<Test[]>([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')

  // Tests in the same project (excluding self and existing prerequisites)
  useEffect(() => {
    api.get<Test[]>(`/projects/${test.projectId}/tests`).then((tests) => {
      setAllTests(
        tests.filter(
          (t) =>
            t.id !== test.id &&
            !test.prerequisites.some((p) => p.id === t.id)
        )
      )
    })
  }, [test])

  async function handleAdd() {
    if (!selectedId) return
    setError('')
    setAdding(true)
    try {
      await api.post(`/tests/${test.id}/prerequisites`, {
        prerequisiteId: selectedId,
      })
      setSelectedId('')
      onUpdate()
    } catch (err: any) {
      setError(err.message ?? 'Failed to add prerequisite')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(prerequisiteId: string) {
    await api.delete(`/tests/${test.id}/prerequisites/${prerequisiteId}`)
    onUpdate()
  }

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm text-blue-800 font-medium mb-1">
          How prerequisites work
        </p>
        <p className="text-sm text-blue-700">
          When you run this test, all prerequisite tests run first in order.
          If any prerequisite fails, this test is marked as failed without running.
        </p>
      </div>

      {/* Add prerequisite */}
      {allTests.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-medium text-gray-900 mb-4">Add prerequisite</h3>
          <div className="flex gap-3">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select a test...</option>
              {allTests.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedId || adding}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                         rounded-lg hover:bg-blue-700 disabled:opacity-50
                         transition-colors"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </div>
      )}

      {/* Current prerequisites */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {test.prerequisites.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            No prerequisites — this test runs independently
          </p>
        ) : (
          test.prerequisites.map((prereq, idx) => (
            <div key={prereq.id}
              className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400 w-5">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {prereq.name}
                </span>
              </div>
              <button
                onClick={() => handleRemove(prereq.id)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {allTests.length === 0 && test.prerequisites.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          Create more tests in this project to add prerequisites
        </p>
      )}
    </div>
  )
}
```

### StepEditor component

**`apps/web/src/components/tests/StepEditor.tsx`**
```typescript
'use client'

import { useState } from 'react'
import { TestStep, StepAction, SelectorType } from '@/lib/types'

const SELECTOR_ACTIONS: StepAction[] = [
  'CLICK', 'FILL', 'SELECT', 'CHECK', 'HOVER',
  'PRESS_KEY', 'ASSERT_VISIBLE', 'SCROLL',
]
const VALUE_ACTIONS: StepAction[] = [
  'NAVIGATE', 'FILL', 'SELECT', 'PRESS_KEY',
  'WAIT', 'ASSERT_TEXT', 'ASSERT_URL',
]

const ACTION_LABELS: Record<StepAction, string> = {
  NAVIGATE: 'Navigate to URL',
  CLICK: 'Click',
  FILL: 'Fill / Type',
  SELECT: 'Select option',
  CHECK: 'Check / Uncheck',
  HOVER: 'Hover',
  PRESS_KEY: 'Press key',
  WAIT: 'Wait',
  ASSERT_TEXT: 'Assert text visible',
  ASSERT_VISIBLE: 'Assert element visible',
  ASSERT_URL: 'Assert URL',
  SCROLL: 'Scroll',
}

const VALUE_PLACEHOLDERS: Partial<Record<StepAction, string>> = {
  NAVIGATE: 'https://example.com/login',
  FILL: 'Text to type',
  SELECT: 'Option value',
  PRESS_KEY: 'Enter',
  WAIT: '1000',
  ASSERT_TEXT: 'Expected text on page',
  ASSERT_URL: '/dashboard',
}

interface LocalStep {
  _key: string
  id?: string
  stepIndex: number
  description: string
  action: StepAction
  selector: string
  selectorType: SelectorType
  value: string
  waitBefore: number
  timeoutMs: number
}

interface Props {
  test: { id: string }
  steps: TestStep[]
  onSave: (steps: Omit<LocalStep, '_key'>[]) => Promise<void>
}

export function StepEditor({ steps: initialSteps, onSave }: Props) {
  const [steps, setSteps] = useState<LocalStep[]>(
    initialSteps.map((s) => ({
      _key: s.id,
      id: s.id,
      stepIndex: s.stepIndex,
      description: s.description ?? '',
      action: s.action,
      selector: s.selector ?? '',
      selectorType: s.selectorType,
      value: s.value ?? '',
      waitBefore: s.waitBefore,
      timeoutMs: s.timeoutMs,
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
        description: '',
        action: 'CLICK',
        selector: '',
        selectorType: 'CSS',
        value: '',
        waitBefore: 0,
        timeoutMs: 10000,
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

      {steps.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed
                        border-gray-300">
          <p className="text-gray-400 text-sm mb-4">No steps yet</p>
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
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center
                                  justify-center text-xs font-mono text-gray-500
                                  shrink-0 mt-1">
                    {idx + 1}
                  </div>

                  <div className="flex-1 space-y-2.5">
                    {/* Description + Action */}
                    <div className="flex gap-2">
                      <input
                        value={step.description}
                        onChange={(e) => update(step._key, { description: e.target.value })}
                        placeholder="Step label (optional)"
                        className="flex-1 px-3 py-1.5 border border-gray-200
                                   rounded-lg text-sm focus:outline-none
                                   focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={step.action}
                        onChange={(e) => update(step._key, {
                          action: e.target.value as StepAction,
                          selector: '',
                          value: '',
                        })}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg
                                   text-sm bg-white focus:outline-none
                                   focus:ring-2 focus:ring-blue-500 shrink-0"
                      >
                        {(Object.entries(ACTION_LABELS) as [StepAction, string][])
                          .map(([a, label]) => (
                            <option key={a} value={a}>{label}</option>
                          ))}
                      </select>
                    </div>

                    {/* Selector */}
                    {SELECTOR_ACTIONS.includes(step.action) && (
                      <div className="flex gap-2">
                        <select
                          value={step.selectorType}
                          onChange={(e) => update(step._key, {
                            selectorType: e.target.value as SelectorType,
                          })}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg
                                     text-sm bg-white focus:outline-none
                                     focus:ring-2 focus:ring-blue-500 shrink-0"
                        >
                          <option value="CSS">CSS</option>
                          <option value="XPATH">XPath</option>
                        </select>
                        <input
                          value={step.selector}
                          onChange={(e) => update(step._key, { selector: e.target.value })}
                          placeholder={
                            step.selectorType === 'XPATH'
                              ? '//button[@data-testid="submit"]'
                              : 'button[type="submit"], .btn-primary, #login-btn'
                          }
                          className="flex-1 px-3 py-1.5 border border-gray-200
                                     rounded-lg text-sm font-mono focus:outline-none
                                     focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Value */}
                    {VALUE_ACTIONS.includes(step.action) && (
                      <input
                        value={step.value}
                        onChange={(e) => update(step._key, { value: e.target.value })}
                        placeholder={VALUE_PLACEHOLDERS[step.action] ?? 'Value'}
                        className="w-full px-3 py-1.5 border border-gray-200
                                   rounded-lg text-sm focus:outline-none
                                   focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => move(step._key, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 text-gray-300 hover:text-gray-600
                                 disabled:opacity-20 transition-colors text-xs">
                      ▲
                    </button>
                    <button onClick={() => move(step._key, 'down')}
                      disabled={idx === steps.length - 1}
                      className="p-1.5 text-gray-300 hover:text-gray-600
                                 disabled:opacity-20 transition-colors text-xs">
                      ▼
                    </button>
                    <button onClick={() => remove(step._key)}
                      className="p-1.5 text-gray-300 hover:text-red-500
                                 transition-colors text-xs">
                      ✕
                    </button>
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

### RunHistory, Run page, New test page

These are identical to Phase 3 original guide — copy them in:
- `apps/web/src/components/tests/RunHistory.tsx`
- `apps/web/src/app/runs/[id]/page.tsx`
- `apps/web/src/app/projects/[id]/tests/new/page.tsx`

---

## Acceptance Criteria

**Tests**
- [ ] `POST /projects/:id/tests` creates test, placed at end of list
- [ ] `GET /projects/:id/tests` returns tests ordered by `order` ASC
- [ ] `PATCH /projects/:projectId/tests/reorder` updates order for all tests
- [ ] Tests list has drag-to-reorder, persists on drag end
- [ ] `PUT /tests/:id/steps` replaces all steps atomically
- [ ] Steps reorder correctly with ▲ ▼ buttons
- [ ] VIEWER cannot create, edit, or delete tests (403)

**Prerequisites**
- [ ] `POST /tests/:id/prerequisites` adds a prerequisite
- [ ] Adding a prerequisite that would create a cycle returns 400 with clear message
- [ ] Adding self as prerequisite returns 400
- [ ] Adding a test from another project returns 400
- [ ] Adding duplicate prerequisite returns 409
- [ ] Deleting a test that is a prerequisite of another returns 409 with names
- [ ] Prerequisites tab shows current prerequisites with remove button
- [ ] Dropdown only shows eligible tests (not self, not already added)

**Runs**
- [ ] `POST /tests/:testId/runs` queues prerequisites first, then the test
- [ ] If prerequisite run fails, dependent run is marked FAILED with message
- [ ] `POST /projects/:projectId/runs` queues all enabled tests in topological order
- [ ] `GET /runs/:id/stream` emits `step` events via SSE
- [ ] Run page shows live step results
- [ ] Tests with 0 steps return 400

---

## Tips for Claude Code

1. **Install Playwright browsers** after `pnpm install`:
   ```bash
   pnpm --filter @iris/runner exec playwright install chromium
   ```

2. **Cycle detection test cases to verify:**
   - A → A (self): blocked ✓
   - A → B → A (direct loop): blocked ✓
   - A → B → C → A (transitive): blocked ✓
   - A → B → C (no cycle): allowed ✓

3. **Topological sort handles tests with no prerequisites** — they get
   `inDegree: 0` and go first in the queue. Tests with the same number of
   resolved prerequisites can run in any order among themselves.

4. **The `prerequisiteRunIds` in the job payload** are checked at job
   execution time, not queue time. This means even if a prerequisite job
   is still running when the dependent job starts processing, the processor
   will fetch the current status from the DB at that point.

5. **Drag to reorder** uses the native HTML5 drag API — no library needed.
   The `onDragOver` handler reorders the local state immediately for smooth
   visual feedback, and `onDragEnd` persists to the API once.