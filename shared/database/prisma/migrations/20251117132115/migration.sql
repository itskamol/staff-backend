/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,short_name]` on the table `departments` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."departments_organization_id_full_name_key";

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "organization_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_short_name_key" ON "departments"("organization_id", "short_name");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
