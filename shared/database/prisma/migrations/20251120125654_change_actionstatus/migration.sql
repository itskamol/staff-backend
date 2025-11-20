/*
  Warnings:

  - The values [EXECUTED,UNEXECUTED] on the enum `ActionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ActionStatus_new" AS ENUM ('ON_TIME', 'LATE', 'EARLY', 'ABSENT', 'PENDING');
ALTER TABLE "actions" ALTER COLUMN "status" TYPE "ActionStatus_new" USING ("status"::text::"ActionStatus_new");
ALTER TABLE "attendances" ALTER COLUMN "arrival_status" TYPE "ActionStatus_new" USING ("arrival_status"::text::"ActionStatus_new");
ALTER TABLE "attendances" ALTER COLUMN "gone_status" TYPE "ActionStatus_new" USING ("gone_status"::text::"ActionStatus_new");
ALTER TYPE "ActionStatus" RENAME TO "ActionStatus_old";
ALTER TYPE "ActionStatus_new" RENAME TO "ActionStatus";
DROP TYPE "public"."ActionStatus_old";
COMMIT;
