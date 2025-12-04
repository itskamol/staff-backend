/*
  Warnings:

  - You are about to drop the column `value` on the `Reasons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Reasons" DROP COLUMN "value",
ADD COLUMN     "eng" TEXT,
ADD COLUMN     "ru" TEXT,
ADD COLUMN     "uz" TEXT;
