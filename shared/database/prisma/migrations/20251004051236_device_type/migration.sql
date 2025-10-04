/*
  Warnings:

  - Added the required column `type` to the `devices` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."DeviceType" AS ENUM ('FACE', 'CARD', 'CAR', 'QR', 'ACCESS_CONTROL', 'BIOMETRIC', 'OTHER');

-- AlterTable
ALTER TABLE "public"."devices" ADD COLUMN     "type" "public"."DeviceType" NOT NULL;

-- DropEnum
DROP TYPE "public"."RuleType";
