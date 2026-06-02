-- AlterTable
ALTER TABLE "test_run_steps" ADD COLUMN     "cachedTokens" INTEGER,
ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "costUsd" DECIMAL(12,8),
ADD COLUMN     "promptTokens" INTEGER,
ADD COLUMN     "reasoningTokens" INTEGER;

-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN     "cachedTokens" INTEGER,
ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "costUsd" DECIMAL(12,8),
ADD COLUMN     "promptTokens" INTEGER,
ADD COLUMN     "reasoningTokens" INTEGER;
