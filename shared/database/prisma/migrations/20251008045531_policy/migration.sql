/*
  Warnings:

  - You are about to drop the column `created_by_id` on the `policies` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `policies` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by_id` on the `policies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."policies" DROP COLUMN "created_by_id",
DROP COLUMN "deleted_at",
DROP COLUMN "updated_by_id",
ALTER COLUMN "active_window" SET DEFAULT false,
ALTER COLUMN "screenshot" SET DEFAULT false,
ALTER COLUMN "visited_sites" SET DEFAULT false;
