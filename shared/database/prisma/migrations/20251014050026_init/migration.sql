/*
  Warnings:

  - You are about to drop the column `group_id` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the `employee_groups` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `policy_id` to the `employees` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."employee_groups" DROP CONSTRAINT "employee_groups_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employee_groups" DROP CONSTRAINT "employee_groups_policyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."employees" DROP CONSTRAINT "employees_group_id_fkey";

-- DropIndex
DROP INDEX "public"."employees_organization_id_group_id_idx";

-- AlterTable
ALTER TABLE "public"."employees" DROP COLUMN "group_id",
ADD COLUMN     "policy_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."employee_groups";

-- CreateIndex
CREATE INDEX "employees_organization_id_policy_id_idx" ON "public"."employees"("organization_id", "policy_id");

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
