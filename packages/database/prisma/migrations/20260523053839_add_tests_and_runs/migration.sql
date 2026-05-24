-- CreateEnum
CREATE TYPE "StepAction" AS ENUM ('NAVIGATE', 'CLICK', 'FILL', 'SELECT', 'CHECK', 'HOVER', 'PRESS_KEY', 'WAIT', 'ASSERT_TEXT', 'ASSERT_VISIBLE', 'ASSERT_URL', 'SCROLL');

-- CreateEnum
CREATE TYPE "SelectorType" AS ENUM ('CSS', 'XPATH');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RunTrigger" AS ENUM ('MANUAL', 'SCHEDULE', 'API');

-- CreateEnum
CREATE TYPE "StepResult" AS ENUM ('PASSED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_steps" (
    "id" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "description" TEXT,
    "action" "StepAction" NOT NULL,
    "selector" TEXT,
    "selectorType" "SelectorType" NOT NULL DEFAULT 'CSS',
    "value" TEXT,
    "waitBefore" INTEGER NOT NULL DEFAULT 0,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "testId" TEXT NOT NULL,

    CONSTRAINT "test_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "RunTrigger" NOT NULL DEFAULT 'MANUAL',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "passedSteps" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "projectRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "testId" TEXT NOT NULL,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_steps" (
    "id" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "description" TEXT,
    "action" "StepAction" NOT NULL,
    "selector" TEXT,
    "selectorType" "SelectorType",
    "value" TEXT,
    "result" "StepResult" NOT NULL,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "screenshotUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runId" TEXT NOT NULL,
    "testStepId" TEXT,

    CONSTRAINT "test_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TestPrerequisites" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TestPrerequisites_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_steps_testId_stepIndex_key" ON "test_steps"("testId", "stepIndex");

-- CreateIndex
CREATE INDEX "_TestPrerequisites_B_index" ON "_TestPrerequisites"("B");

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_steps" ADD CONSTRAINT "test_steps_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_steps" ADD CONSTRAINT "test_run_steps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_steps" ADD CONSTRAINT "test_run_steps_testStepId_fkey" FOREIGN KEY ("testStepId") REFERENCES "test_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TestPrerequisites" ADD CONSTRAINT "_TestPrerequisites_A_fkey" FOREIGN KEY ("A") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TestPrerequisites" ADD CONSTRAINT "_TestPrerequisites_B_fkey" FOREIGN KEY ("B") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
