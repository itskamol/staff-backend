/*
  Warnings:

  - You are about to drop the column `users_on_computers_id` on the `active_windows` table. All the data in the column will be lost.
  - You are about to drop the column `group_id` on the `resource_groups` table. All the data in the column will be lost.
  - You are about to drop the column `resource_id` on the `resource_groups` table. All the data in the column will be lost.
  - You are about to drop the column `users_on_computers_id` on the `screenshots` table. All the data in the column will be lost.
  - You are about to drop the column `users_on_computers_id` on the `user_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `users_on_computers_id` on the `visited_sites` table. All the data in the column will be lost.
  - You are about to drop the `Attendance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmployeePlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmployeeSync` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GateEmployee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `department_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `policy_options` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `resource_group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rule_groups` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users_on_computers` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[organization_id,name,type]` on the table `resource_groups` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `computer_user_id` to the `active_windows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `active_windows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `change_histories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `computer_users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `computers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `onetime_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `resource_groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `resource_groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `resource_groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `resource_groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `computer_user_id` to the `screenshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `screenshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `computer_user_id` to the `user_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `user_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `computer_user_id` to the `visited_sites` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `visited_sites` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `visitors` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Attendance" DROP CONSTRAINT "Attendance_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Attendance" DROP CONSTRAINT "Attendance_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmployeePlan" DROP CONSTRAINT "EmployeePlan_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmployeeSync" DROP CONSTRAINT "EmployeeSync_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmployeeSync" DROP CONSTRAINT "EmployeeSync_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmployeeSync" DROP CONSTRAINT "EmployeeSync_gateId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmployeeSync" DROP CONSTRAINT "EmployeeSync_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."GateEmployee" DROP CONSTRAINT "GateEmployee_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GateEmployee" DROP CONSTRAINT "GateEmployee_gateId_fkey";

-- DropForeignKey
ALTER TABLE "public"."active_windows" DROP CONSTRAINT "active_windows_users_on_computers_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."department_users" DROP CONSTRAINT "department_users_department_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."department_users" DROP CONSTRAINT "department_users_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employees" DROP CONSTRAINT "employees_employeePlanId_fkey";

-- DropForeignKey
ALTER TABLE "public"."policy_options" DROP CONSTRAINT "policy_options_policy_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."resource_group" DROP CONSTRAINT "resource_group_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."resource_groups" DROP CONSTRAINT "resource_groups_group_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."resource_groups" DROP CONSTRAINT "resource_groups_resource_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."rule_groups" DROP CONSTRAINT "rule_groups_group_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."rule_groups" DROP CONSTRAINT "rule_groups_option_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."screenshots" DROP CONSTRAINT "screenshots_users_on_computers_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_sessions" DROP CONSTRAINT "user_sessions_users_on_computers_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."users_on_computers" DROP CONSTRAINT "users_on_computers_computer_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."users_on_computers" DROP CONSTRAINT "users_on_computers_computer_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."visited_sites" DROP CONSTRAINT "visited_sites_users_on_computers_id_fkey";

-- DropIndex
DROP INDEX "public"."active_windows_users_on_computers_id_datetime_idx";

-- DropIndex
DROP INDEX "public"."active_windows_users_on_computers_id_idx";

-- DropIndex
DROP INDEX "public"."onetime_codes_code_idx";

-- DropIndex
DROP INDEX "public"."onetime_codes_is_active_idx";

-- DropIndex
DROP INDEX "public"."onetime_codes_start_date_end_date_idx";

-- DropIndex
DROP INDEX "public"."onetime_codes_visitor_id_idx";

-- DropIndex
DROP INDEX "public"."policies_created_at_idx";

-- DropIndex
DROP INDEX "public"."policies_organization_id_idx";

-- DropIndex
DROP INDEX "public"."policies_organization_id_is_active_idx";

-- DropIndex
DROP INDEX "public"."policies_organization_id_is_default_idx";

-- DropIndex
DROP INDEX "public"."policies_organization_id_title_idx";

-- DropIndex
DROP INDEX "public"."resources_organization_id_idx";

-- DropIndex
DROP INDEX "public"."resources_organization_id_type_idx";

-- DropIndex
DROP INDEX "public"."screenshots_users_on_computers_id_datetime_idx";

-- DropIndex
DROP INDEX "public"."screenshots_users_on_computers_id_idx";

-- DropIndex
DROP INDEX "public"."user_sessions_users_on_computers_id_idx";

-- DropIndex
DROP INDEX "public"."user_sessions_users_on_computers_id_start_time_idx";

-- DropIndex
DROP INDEX "public"."users_is_active_idx";

-- DropIndex
DROP INDEX "public"."users_organization_id_role_idx";

-- DropIndex
DROP INDEX "public"."users_role_idx";

-- DropIndex
DROP INDEX "public"."users_username_idx";

-- DropIndex
DROP INDEX "public"."visited_sites_users_on_computers_id_datetime_idx";

-- DropIndex
DROP INDEX "public"."visited_sites_users_on_computers_id_idx";

-- DropIndex
DROP INDEX "public"."visitors_created_at_idx";

-- DropIndex
DROP INDEX "public"."visitors_creator_id_idx";

-- DropIndex
DROP INDEX "public"."visitors_is_active_idx";

-- DropIndex
DROP INDEX "public"."visitors_passport_number_idx";

-- DropIndex
DROP INDEX "public"."visitors_phone_idx";

-- DropIndex
DROP INDEX "public"."visitors_pinfl_idx";

-- AlterTable
ALTER TABLE "active_windows" DROP COLUMN "users_on_computers_id",
ADD COLUMN     "computer_user_id" INTEGER NOT NULL,
ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "change_histories" ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "computer_users" ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "computers" ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "onetime_codes" ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "resource_groups" DROP COLUMN "group_id",
DROP COLUMN "resource_id",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "organization_id" INTEGER NOT NULL,
ADD COLUMN     "type" "ResourceType" NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "screenshots" DROP COLUMN "users_on_computers_id",
ADD COLUMN     "computer_user_id" INTEGER NOT NULL,
ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "user_sessions" DROP COLUMN "users_on_computers_id",
ADD COLUMN     "computer_user_id" INTEGER NOT NULL,
ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "visited_sites" DROP COLUMN "users_on_computers_id",
ADD COLUMN     "computer_user_id" INTEGER NOT NULL,
ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "visitors" ADD COLUMN     "organization_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."Attendance";

-- DropTable
DROP TABLE "public"."EmployeePlan";

-- DropTable
DROP TABLE "public"."EmployeeSync";

-- DropTable
DROP TABLE "public"."GateEmployee";

-- DropTable
DROP TABLE "public"."department_users";

-- DropTable
DROP TABLE "public"."policy_options";

-- DropTable
DROP TABLE "public"."resource_group";

-- DropTable
DROP TABLE "public"."rule_groups";

-- DropTable
DROP TABLE "public"."users_on_computers";

-- CreateTable
CREATE TABLE "attendances" (
    "id" SERIAL NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "arrival_status" "ActionStatus" NOT NULL,
    "gone_status" "ActionStatus",
    "reason" TEXT,
    "employee_id" INTEGER NOT NULL,
    "organization_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_syncs" (
    "id" SERIAL NOT NULL,
    "gate_id" INTEGER NOT NULL,
    "device_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "organization_id" INTEGER,
    "status" "StatusEnum" NOT NULL DEFAULT 'WAITING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_plans" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "name" TEXT,
    "additional_details" TEXT,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "extra_time" TEXT NOT NULL,
    "weekdays" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "employee_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_rules" (
    "id" SERIAL NOT NULL,
    "policy_id" INTEGER NOT NULL,
    "resource_group_id" INTEGER NOT NULL,
    "type" "RuleType" NOT NULL,

    CONSTRAINT "policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources_on_groups" (
    "resource_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resources_on_groups_pkey" PRIMARY KEY ("resource_id","group_id")
);

-- CreateTable
CREATE TABLE "_ComputerToComputerUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ComputerToComputerUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EmployeeToGate" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_EmployeeToGate_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DepartmentToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DepartmentToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "attendances_start_time_end_time_idx" ON "attendances"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "attendances_employee_id_idx" ON "attendances"("employee_id");

-- CreateIndex
CREATE INDEX "attendances_organization_id_idx" ON "attendances"("organization_id");

-- CreateIndex
CREATE INDEX "employee_syncs_organization_id_idx" ON "employee_syncs"("organization_id");

-- CreateIndex
CREATE INDEX "employee_syncs_gate_id_idx" ON "employee_syncs"("gate_id");

-- CreateIndex
CREATE INDEX "employee_syncs_device_id_idx" ON "employee_syncs"("device_id");

-- CreateIndex
CREATE INDEX "employee_syncs_employee_id_idx" ON "employee_syncs"("employee_id");

-- CreateIndex
CREATE INDEX "employee_syncs_status_idx" ON "employee_syncs"("status");

-- CreateIndex
CREATE INDEX "employee_plans_organization_id_idx" ON "employee_plans"("organization_id");

-- CreateIndex
CREATE INDEX "employee_plans_isActive_idx" ON "employee_plans"("isActive");

-- CreateIndex
CREATE INDEX "policy_rules_policy_id_idx" ON "policy_rules"("policy_id");

-- CreateIndex
CREATE INDEX "policy_rules_resource_group_id_idx" ON "policy_rules"("resource_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_rules_policy_id_resource_group_id_type_key" ON "policy_rules"("policy_id", "resource_group_id", "type");

-- CreateIndex
CREATE INDEX "_ComputerToComputerUser_B_index" ON "_ComputerToComputerUser"("B");

-- CreateIndex
CREATE INDEX "_EmployeeToGate_B_index" ON "_EmployeeToGate"("B");

-- CreateIndex
CREATE INDEX "_DepartmentToUser_B_index" ON "_DepartmentToUser"("B");

-- CreateIndex
CREATE INDEX "actions_organization_id_idx" ON "actions"("organization_id");

-- CreateIndex
CREATE INDEX "active_windows_organization_id_idx" ON "active_windows"("organization_id");

-- CreateIndex
CREATE INDEX "active_windows_computer_user_id_idx" ON "active_windows"("computer_user_id");

-- CreateIndex
CREATE INDEX "active_windows_computer_user_id_datetime_idx" ON "active_windows"("computer_user_id", "datetime");

-- CreateIndex
CREATE INDEX "change_histories_organization_id_idx" ON "change_histories"("organization_id");

-- CreateIndex
CREATE INDEX "computer_users_organization_id_idx" ON "computer_users"("organization_id");

-- CreateIndex
CREATE INDEX "computers_organization_id_idx" ON "computers"("organization_id");

-- CreateIndex
CREATE INDEX "devices_organization_id_idx" ON "devices"("organization_id");

-- CreateIndex
CREATE INDEX "gates_organization_id_idx" ON "gates"("organization_id");

-- CreateIndex
CREATE INDEX "onetime_codes_organization_id_idx" ON "onetime_codes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_groups_organization_id_name_type_key" ON "resource_groups"("organization_id", "name", "type");

-- CreateIndex
CREATE INDEX "screenshots_computer_user_id_idx" ON "screenshots"("computer_user_id");

-- CreateIndex
CREATE INDEX "screenshots_computer_user_id_datetime_idx" ON "screenshots"("computer_user_id", "datetime");

-- CreateIndex
CREATE INDEX "user_sessions_organization_id_idx" ON "user_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "user_sessions_computer_user_id_idx" ON "user_sessions"("computer_user_id");

-- CreateIndex
CREATE INDEX "user_sessions_computer_user_id_start_time_idx" ON "user_sessions"("computer_user_id", "start_time");

-- CreateIndex
CREATE INDEX "visited_sites_organization_id_idx" ON "visited_sites"("organization_id");

-- CreateIndex
CREATE INDEX "visited_sites_computer_user_id_idx" ON "visited_sites"("computer_user_id");

-- CreateIndex
CREATE INDEX "visited_sites_computer_user_id_datetime_idx" ON "visited_sites"("computer_user_id", "datetime");

-- CreateIndex
CREATE INDEX "visitors_organization_id_idx" ON "visitors"("organization_id");

-- AddForeignKey
ALTER TABLE "computer_users" ADD CONSTRAINT "computer_users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computers" ADD CONSTRAINT "computers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_employeePlanId_fkey" FOREIGN KEY ("employeePlanId") REFERENCES "employee_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_syncs" ADD CONSTRAINT "employee_syncs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_syncs" ADD CONSTRAINT "employee_syncs_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_syncs" ADD CONSTRAINT "employee_syncs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_syncs" ADD CONSTRAINT "employee_syncs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_plans" ADD CONSTRAINT "employee_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_histories" ADD CONSTRAINT "change_histories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_windows" ADD CONSTRAINT "active_windows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_windows" ADD CONSTRAINT "active_windows_computer_user_id_fkey" FOREIGN KEY ("computer_user_id") REFERENCES "computer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visited_sites" ADD CONSTRAINT "visited_sites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visited_sites" ADD CONSTRAINT "visited_sites_computer_user_id_fkey" FOREIGN KEY ("computer_user_id") REFERENCES "computer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_computer_user_id_fkey" FOREIGN KEY ("computer_user_id") REFERENCES "computer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_computer_user_id_fkey" FOREIGN KEY ("computer_user_id") REFERENCES "computer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_rules" ADD CONSTRAINT "policy_rules_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_rules" ADD CONSTRAINT "policy_rules_resource_group_id_fkey" FOREIGN KEY ("resource_group_id") REFERENCES "resource_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_groups" ADD CONSTRAINT "resource_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources_on_groups" ADD CONSTRAINT "resources_on_groups_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources_on_groups" ADD CONSTRAINT "resources_on_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "resource_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onetime_codes" ADD CONSTRAINT "onetime_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ComputerToComputerUser" ADD CONSTRAINT "_ComputerToComputerUser_A_fkey" FOREIGN KEY ("A") REFERENCES "computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ComputerToComputerUser" ADD CONSTRAINT "_ComputerToComputerUser_B_fkey" FOREIGN KEY ("B") REFERENCES "computer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmployeeToGate" ADD CONSTRAINT "_EmployeeToGate_A_fkey" FOREIGN KEY ("A") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmployeeToGate" ADD CONSTRAINT "_EmployeeToGate_B_fkey" FOREIGN KEY ("B") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentToUser" ADD CONSTRAINT "_DepartmentToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentToUser" ADD CONSTRAINT "_DepartmentToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
