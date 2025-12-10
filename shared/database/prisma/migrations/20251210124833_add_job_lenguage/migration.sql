/*
  Warnings:

  - You are about to drop the column `title` on the `jobs` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "jobs_title_idx";

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "title",
ADD COLUMN     "eng" TEXT,
ADD COLUMN     "ru" TEXT,
ADD COLUMN     "uz" TEXT;

-- CreateIndex
CREATE INDEX "jobs_uz_ru_eng_idx" ON "jobs"("uz", "ru", "eng");
