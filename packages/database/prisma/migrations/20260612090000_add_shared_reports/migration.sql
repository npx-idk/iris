-- CreateTable
CREATE TABLE "shared_reports" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "shared_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_reports_token_key" ON "shared_reports"("token");

-- CreateIndex
CREATE UNIQUE INDEX "shared_reports_runId_key" ON "shared_reports"("runId");
