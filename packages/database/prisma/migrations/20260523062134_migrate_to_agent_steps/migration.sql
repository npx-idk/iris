/*
  Warnings:

  - You are about to drop the column `action` on the `test_run_steps` table. All the data in the column will be lost.
  - You are about to drop the column `selector` on the `test_run_steps` table. All the data in the column will be lost.
  - You are about to drop the column `selectorType` on the `test_run_steps` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `test_run_steps` table. All the data in the column will be lost.
  - You are about to drop the column `action` on the `test_steps` table. All the data in the column will be lost.
  - You are about to drop the column `selector` on the `test_steps` table. All the data in the column will be lost.
  - You are about to drop the column `selectorType` on the `test_steps` table. All the data in the column will be lost.
  - You are about to drop the column `timeoutMs` on the `test_steps` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `test_steps` table. All the data in the column will be lost.
  - You are about to drop the column `waitBefore` on the `test_steps` table. All the data in the column will be lost.
  - Added the required column `instruction` to the `test_run_steps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `instruction` to the `test_steps` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "test_run_steps" DROP COLUMN "action",
DROP COLUMN "selector",
DROP COLUMN "selectorType",
DROP COLUMN "value",
ADD COLUMN     "cacheStatus" TEXT,
ADD COLUMN     "instruction" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN     "browserEnv" TEXT,
ADD COLUMN     "cacheHits" INTEGER,
ADD COLUMN     "inferenceTimeMs" INTEGER,
ADD COLUMN     "liveViewUrl" TEXT,
ADD COLUMN     "totalTokens" INTEGER;

-- AlterTable
ALTER TABLE "test_steps" DROP COLUMN "action",
DROP COLUMN "selector",
DROP COLUMN "selectorType",
DROP COLUMN "timeoutMs",
DROP COLUMN "value",
DROP COLUMN "waitBefore",
ADD COLUMN     "instruction" TEXT NOT NULL,
ADD COLUMN     "variables" JSONB;

-- DropEnum
DROP TYPE "SelectorType";

-- DropEnum
DROP TYPE "StepAction";
