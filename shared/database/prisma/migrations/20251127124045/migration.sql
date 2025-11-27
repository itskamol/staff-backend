/*
  Warnings:

  - The values [FIELD] on the enum `StatusEnum` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StatusEnum_new" AS ENUM ('WAITING', 'PROCESS', 'DONE', 'FAILED');
ALTER TABLE "public"."employee_syncs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "employee_syncs" ALTER COLUMN "status" TYPE "StatusEnum_new" USING ("status"::text::"StatusEnum_new");
ALTER TYPE "StatusEnum" RENAME TO "StatusEnum_old";
ALTER TYPE "StatusEnum_new" RENAME TO "StatusEnum";
DROP TYPE "public"."StatusEnum_old";
ALTER TABLE "employee_syncs" ALTER COLUMN "status" SET DEFAULT 'WAITING';
COMMIT;
