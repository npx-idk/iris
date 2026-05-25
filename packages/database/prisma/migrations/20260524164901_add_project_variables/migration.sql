/*
  Warnings:

  - You are about to drop the column `browserType` on the `test_runs` table. All the data in the column will be lost.
  - You are about to drop the column `browserType` on the `tests` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "test_runs" DROP COLUMN "browserType";

-- AlterTable
ALTER TABLE "tests" DROP COLUMN "browserType";

-- CreateTable
CREATE TABLE "project_variables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "project_variables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_variables_projectId_name_key" ON "project_variables"("projectId", "name");

-- AddForeignKey
ALTER TABLE "project_variables" ADD CONSTRAINT "project_variables_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
