-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "test_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "test_groups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "test_groups" ADD CONSTRAINT "test_groups_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "test_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
