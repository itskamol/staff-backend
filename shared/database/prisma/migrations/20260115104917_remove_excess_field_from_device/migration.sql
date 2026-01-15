/*
  Warnings:

  - You are about to drop the column `welcome_photo` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the column `welcome_photo_type` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the column `welcome_text` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the column `welcome_text_type` on the `devices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "devices" DROP COLUMN "welcome_photo",
DROP COLUMN "welcome_photo_type",
DROP COLUMN "welcome_text",
DROP COLUMN "welcome_text_type";
