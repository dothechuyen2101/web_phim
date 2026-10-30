-- AlterTable
ALTER TABLE "EpisodeLink" ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "failCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "streamUrl" TEXT;

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "rescuedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "failureStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "mirrors" TEXT[],
ADD COLUMN     "pausedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EpisodeLink_broken_checkedAt_idx" ON "EpisodeLink"("broken", "checkedAt");

-- CreateIndex
CREATE INDEX "Report_episodeLinkId_createdAt_idx" ON "Report"("episodeLinkId", "createdAt");

