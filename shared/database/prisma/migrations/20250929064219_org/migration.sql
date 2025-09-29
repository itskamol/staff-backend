/*
  Warnings:

  - Added the required column `organization_id` to the `employees` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."employees" ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
