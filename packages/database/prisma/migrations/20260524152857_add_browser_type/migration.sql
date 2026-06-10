-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN "browserType" TEXT;

-- AlterTable
ALTER TABLE "tests" ADD COLUMN "browserType" TEXT NOT NULL DEFAULT 'chromium';
