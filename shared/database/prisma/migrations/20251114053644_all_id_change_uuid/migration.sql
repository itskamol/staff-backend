/*
  Warnings:

  - The primary key for the `Attendance` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `EmployeePlan` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `EmployeeSync` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `GateEmployee` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `actions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `active_windows` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `change_histories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `computer_users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `computers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `credentials` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `department_users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `departments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `devices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `employees` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `gates` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `onetime_codes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `organizations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `policies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `policy_options` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `resource_group` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `resource_groups` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `resources` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `rule_groups` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `screenshots` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users_on_computers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `visited_sites` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `visitors` table will be changed. If it partially fails, the table could be left without primary key constraint.

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
ALTER TABLE "public"."actions" DROP CONSTRAINT "actions_device_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."actions" DROP CONSTRAINT "actions_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."actions" DROP CONSTRAINT "actions_gate_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."actions" DROP CONSTRAINT "actions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."actions" DROP CONSTRAINT "actions_visitor_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."active_windows" DROP CONSTRAINT "active_windows_users_on_computers_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."change_histories" DROP CONSTRAINT "change_histories_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."computer_users" DROP CONSTRAINT "computer_users_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."credentials" DROP CONSTRAINT "credentials_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."credentials" DROP CONSTRAINT "credentials_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."department_users" DROP CONSTRAINT "department_users_department_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."department_users" DROP CONSTRAINT "department_users_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."departments" DROP CONSTRAINT "departments_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."departments" DROP CONSTRAINT "departments_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."devices" DROP CONSTRAINT "devices_gate_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employees" DROP CONSTRAINT "employees_department_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employees" DROP CONSTRAINT "employees_employeePlanId_fkey";

-- DropForeignKey
ALTER TABLE "public"."employees" DROP CONSTRAINT "employees_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employees" DROP CONSTRAINT "employees_policy_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."gates" DROP CONSTRAINT "gates_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."onetime_codes" DROP CONSTRAINT "onetime_codes_visitor_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."policies" DROP CONSTRAINT "policies_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."policy_options" DROP CONSTRAINT "policy_options_policy_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."resource_group" DROP CONSTRAINT "resource_group_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."resource_groups" DROP CONSTRAINT "resource_groups_group_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."resource_groups" DROP CONSTRAINT "resource_groups_resource_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."resources" DROP CONSTRAINT "resources_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."rule_groups" DROP CONSTRAINT "rule_groups_group_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."rule_groups" DROP CONSTRAINT "rule_groups_option_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."screenshots" DROP CONSTRAINT "screenshots_users_on_computers_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_sessions" DROP CONSTRAINT "user_sessions_users_on_computers_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."users" DROP CONSTRAINT "users_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."users_on_computers" DROP CONSTRAINT "users_on_computers_computer_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."users_on_computers" DROP CONSTRAINT "users_on_computers_computer_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."visited_sites" DROP CONSTRAINT "visited_sites_users_on_computers_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."visitors" DROP CONSTRAINT "visitors_creator_id_fkey";

-- AlterTable
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "employeeId" SET DATA TYPE TEXT,
ALTER COLUMN "organizationId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Attendance_id_seq";

-- AlterTable
ALTER TABLE "EmployeePlan" DROP CONSTRAINT "EmployeePlan_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "EmployeePlan_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "EmployeePlan_id_seq";

-- AlterTable
ALTER TABLE "EmployeeSync" DROP CONSTRAINT "EmployeeSync_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "employeeId" SET DATA TYPE TEXT,
ALTER COLUMN "deviceId" SET DATA TYPE TEXT,
ALTER COLUMN "gateId" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "EmployeeSync_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "EmployeeSync_id_seq";

-- AlterTable
ALTER TABLE "GateEmployee" DROP CONSTRAINT "GateEmployee_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "employeeId" SET DATA TYPE TEXT,
ALTER COLUMN "gateId" SET DATA TYPE TEXT,
ADD CONSTRAINT "GateEmployee_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "GateEmployee_id_seq";

-- AlterTable
ALTER TABLE "actions" DROP CONSTRAINT "actions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "device_id" SET DATA TYPE TEXT,
ALTER COLUMN "gate_id" SET DATA TYPE TEXT,
ALTER COLUMN "employee_id" SET DATA TYPE TEXT,
ALTER COLUMN "visitor_id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "actions_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "actions_id_seq";

-- AlterTable
ALTER TABLE "active_windows" DROP CONSTRAINT "active_windows_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "users_on_computers_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "active_windows_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "active_windows_id_seq";

-- AlterTable
ALTER TABLE "change_histories" DROP CONSTRAINT "change_histories_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "change_histories_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "change_histories_id_seq";

-- AlterTable
ALTER TABLE "computer_users" DROP CONSTRAINT "computer_users_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "employee_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "computer_users_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "computer_users_id_seq";

-- AlterTable
ALTER TABLE "computers" DROP CONSTRAINT "computers_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "computers_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "computers_id_seq";

-- AlterTable
ALTER TABLE "credentials" DROP CONSTRAINT "credentials_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "employee_id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "credentials_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "credentials_id_seq";

-- AlterTable
ALTER TABLE "department_users" DROP CONSTRAINT "department_users_pkey",
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "department_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "department_users_pkey" PRIMARY KEY ("user_id", "department_id");

-- AlterTable
ALTER TABLE "departments" DROP CONSTRAINT "departments_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ALTER COLUMN "parent_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "departments_id_seq";

-- AlterTable
ALTER TABLE "devices" DROP CONSTRAINT "devices_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "gate_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "devices_id_seq";

-- AlterTable
ALTER TABLE "employees" DROP CONSTRAINT "employees_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "department_id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ALTER COLUMN "policy_id" SET DATA TYPE TEXT,
ALTER COLUMN "employeePlanId" SET DATA TYPE TEXT,
ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "employees_id_seq";

-- AlterTable
ALTER TABLE "gates" DROP CONSTRAINT "gates_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "gates_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "gates_id_seq";

-- AlterTable
ALTER TABLE "onetime_codes" DROP CONSTRAINT "onetime_codes_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "visitor_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "onetime_codes_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "onetime_codes_id_seq";

-- AlterTable
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "organizations_id_seq";

-- AlterTable
ALTER TABLE "policies" DROP CONSTRAINT "policies_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "policies_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "policies_id_seq";

-- AlterTable
ALTER TABLE "policy_options" DROP CONSTRAINT "policy_options_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "policy_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "policy_options_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "policy_options_id_seq";

-- AlterTable
ALTER TABLE "resource_group" DROP CONSTRAINT "resource_group_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "resource_group_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "resource_group_id_seq";

-- AlterTable
ALTER TABLE "resource_groups" DROP CONSTRAINT "resource_groups_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "resource_id" SET DATA TYPE TEXT,
ALTER COLUMN "group_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "resource_groups_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "resource_groups_id_seq";

-- AlterTable
ALTER TABLE "resources" DROP CONSTRAINT "resources_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "resources_id_seq";

-- AlterTable
ALTER TABLE "rule_groups" DROP CONSTRAINT "rule_groups_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "option_id" SET DATA TYPE TEXT,
ALTER COLUMN "group_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "rule_groups_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "rule_groups_id_seq";

-- AlterTable
ALTER TABLE "screenshots" DROP CONSTRAINT "screenshots_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "users_on_computers_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "screenshots_id_seq";

-- AlterTable
ALTER TABLE "user_sessions" DROP CONSTRAINT "user_sessions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "users_on_computers_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "user_sessions_id_seq";

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "users_id_seq";

-- AlterTable
ALTER TABLE "users_on_computers" DROP CONSTRAINT "users_on_computers_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "computer_user_id" SET DATA TYPE TEXT,
ALTER COLUMN "computer_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "users_on_computers_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "users_on_computers_id_seq";

-- AlterTable
ALTER TABLE "visited_sites" DROP CONSTRAINT "visited_sites_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "users_on_computers_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "visited_sites_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "visited_sites_id_seq";

-- AlterTable
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "creator_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "visitors_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "visitors_id_seq";

-- AddForeignKey
ALTER TABLE "computer_users" ADD CONSTRAINT "computer_users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_on_computers" ADD CONSTRAINT "users_on_computers_computer_user_id_fkey" FOREIGN KEY ("computer_user_id") REFERENCES "computer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_on_computers" ADD CONSTRAINT "users_on_computers_computer_id_fkey" FOREIGN KEY ("computer_id") REFERENCES "computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateEmployee" ADD CONSTRAINT "GateEmployee_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateEmployee" ADD CONSTRAINT "GateEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_employeePlanId_fkey" FOREIGN KEY ("employeePlanId") REFERENCES "EmployeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSync" ADD CONSTRAINT "EmployeeSync_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSync" ADD CONSTRAINT "EmployeeSync_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSync" ADD CONSTRAINT "EmployeeSync_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSync" ADD CONSTRAINT "EmployeeSync_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePlan" ADD CONSTRAINT "EmployeePlan_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_histories" ADD CONSTRAINT "change_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_windows" ADD CONSTRAINT "active_windows_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "users_on_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visited_sites" ADD CONSTRAINT "visited_sites_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "users_on_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "users_on_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "users_on_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_options" ADD CONSTRAINT "policy_options_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_groups" ADD CONSTRAINT "rule_groups_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "policy_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_groups" ADD CONSTRAINT "rule_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "resource_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_group" ADD CONSTRAINT "resource_group_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_groups" ADD CONSTRAINT "resource_groups_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_groups" ADD CONSTRAINT "resource_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "resource_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_users" ADD CONSTRAINT "department_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_users" ADD CONSTRAINT "department_users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onetime_codes" ADD CONSTRAINT "onetime_codes_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
