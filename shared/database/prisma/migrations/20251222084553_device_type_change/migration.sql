/*
  Warnings:

  - You are about to drop the column `type` on the `devices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "devices" DROP COLUMN "type",
ADD COLUMN     "types" "ActionType"[] DEFAULT ARRAY[]::"ActionType"[];
