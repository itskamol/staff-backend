-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'HR', 'DEPARTMENT_LEAD', 'GUARD');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('ENTER', 'EXIT', 'BOTH');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('PHOTO', 'CARD', 'CAR', 'QR', 'PERSONAL_CODE', 'ONE_TIME_ID', 'USER');

-- CreateEnum
CREATE TYPE "WelcomeText" AS ENUM ('NO_TEXT', 'CUSTOM_TEXT', 'EMPLOYEE_NAME');

-- CreateEnum
CREATE TYPE "WelcomePhoto" AS ENUM ('NO_PHOTO', 'CUSTOM_PHOTO', 'EMPLOYEE_PHOTO');

-- CreateEnum
CREATE TYPE "VisitorType" AS ENUM ('EMPLOYEE', 'VISITOR');

-- CreateEnum
CREATE TYPE "ActionMode" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('UNLOCKED', 'LOCKED', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "VisitorCodeType" AS ENUM ('ONETIME', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('FACE', 'CARD', 'CAR', 'QR', 'ACCESS_CONTROL', 'BIOMETRIC', 'OTHER');

-- CreateEnum
CREATE TYPE "StatusEnum" AS ENUM ('WAITING', 'PROCESS', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('ON_TIME', 'LATE', 'EARLY', 'ABSENT', 'PENDING');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('USEFUL', 'UNUSEFUL');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('WEBSITE', 'APPLICATION');

-- CreateEnum
CREATE TYPE "OptionType" AS ENUM ('WEBSITE', 'ACTIVE_WINDOW');

-- CreateTable
CREATE TABLE "computer_users" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "sid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "username" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_in_domain" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "organization_id" INTEGER NOT NULL,

    CONSTRAINT "computer_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "computers" (
    "id" SERIAL NOT NULL,
    "computer_uid" TEXT NOT NULL,
    "os" TEXT,
    "ip_address" TEXT,
    "mac_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "organization_id" INTEGER NOT NULL,

    CONSTRAINT "computers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER,
    "gate_id" INTEGER,
    "action_time" TIMESTAMP(3) NOT NULL,
    "employee_id" INTEGER,
    "visitor_id" INTEGER,
    "organization_id" INTEGER,
    "action_result" TEXT,
    "visitorType" "VisitorType" NOT NULL,
    "entryType" "EntryType" NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "actionMode" "ActionMode" NOT NULL,
    "status" "ActionStatus",
    "credential_id" INTEGER,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" SERIAL NOT NULL,
    "gate_id" INTEGER,
    "name" TEXT,
    "entry_type" "EntryType",
    "types" "ActionType"[] DEFAULT ARRAY[]::"ActionType"[],
    "manufacturer" TEXT,
    "model" TEXT,
    "firmware" TEXT,
    "serial_number" TEXT,
    "ip_address" TEXT,
    "login" TEXT,
    "password" TEXT,
    "capabilities" JSONB,
    "welcome_text" TEXT,
    "welcome_text_type" "WelcomeText",
    "welcome_photo" TEXT,
    "welcome_photo_type" "WelcomePhoto",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" SERIAL NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "arrival_status" "ActionStatus" NOT NULL,
    "gone_status" "ActionStatus",
    "reason" TEXT,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "late_arrival_time" INTEGER,
    "early_gone_time" INTEGER,
    "planned_time" INTEGER,
    "employee_id" INTEGER NOT NULL,
    "organization_id" INTEGER,
    "reason_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reasons" (
    "id" SERIAL NOT NULL,
    "uz" TEXT,
    "eng" TEXT,
    "ru" TEXT,
    "organization_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "policy_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "photo" TEXT,
    "additional_details" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "employeePlanId" INTEGER,
    "jobId" INTEGER,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" SERIAL NOT NULL,
    "uz" TEXT,
    "ru" TEXT,
    "eng" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "organization_id" INTEGER NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "code" TEXT,
    "type" "ActionType" NOT NULL,
    "additional_details" TEXT,
    "organization_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_syncs" (
    "id" SERIAL NOT NULL,
    "gate_id" INTEGER NOT NULL,
    "device_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "organization_id" INTEGER,
    "credential_id" INTEGER,
    "status" "StatusEnum" NOT NULL DEFAULT 'WAITING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employee_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_histories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "table_name" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "organization_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "change_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_windows" (
    "id" SERIAL NOT NULL,
    "computer_user_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "icon" TEXT,
    "active_time" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "active_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visited_sites" (
    "id" SERIAL NOT NULL,
    "computer_user_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "icon" TEXT,
    "active_time" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "visited_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screenshots" (
    "id" SERIAL NOT NULL,
    "computer_user_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "file_path" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "icon" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "computer_user_id" INTEGER NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "session_type" "SessionType" NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "additional_details" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "full_name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "additional_details" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active_window" BOOLEAN NOT NULL DEFAULT false,
    "screenshot" BOOLEAN NOT NULL DEFAULT false,
    "visited_sites" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "screenshot_interval" INTEGER NOT NULL DEFAULT 5,
    "screenshot_is_grayscale" BOOLEAN NOT NULL DEFAULT false,
    "screenshot_capture_all" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_rules" (
    "id" SERIAL NOT NULL,
    "policy_id" INTEGER NOT NULL,
    "resource_group_id" INTEGER NOT NULL,
    "type" "RuleType" NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_groups" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "resource_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources_on_groups" (
    "resource_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "resources_on_groups_pkey" PRIMARY KEY ("resource_id","group_id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "organization_id" INTEGER,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitors" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "birthday" TEXT,
    "phone" TEXT,
    "passport_number" TEXT,
    "pinfl" TEXT,
    "work_place" TEXT,
    "additional_details" TEXT,
    "creator_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "organization_id" INTEGER NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onetime_codes" (
    "id" SERIAL NOT NULL,
    "visitor_id" INTEGER NOT NULL,
    "code_type" "VisitorCodeType" NOT NULL,
    "code" TEXT NOT NULL,
    "additional_details" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "organization_id" INTEGER NOT NULL,

    CONSTRAINT "onetime_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ComputerToComputerUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ComputerToComputerUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GateToOrganization" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GateToOrganization_AB_pkey" PRIMARY KEY ("A","B")
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
CREATE UNIQUE INDEX "computer_users_sid_key" ON "computer_users"("sid");

-- CreateIndex
CREATE INDEX "computer_users_organization_id_idx" ON "computer_users"("organization_id");

-- CreateIndex
CREATE INDEX "computer_users_employee_id_idx" ON "computer_users"("employee_id");

-- CreateIndex
CREATE INDEX "computer_users_sid_idx" ON "computer_users"("sid");

-- CreateIndex
CREATE INDEX "computer_users_username_idx" ON "computer_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "computers_computer_uid_key" ON "computers"("computer_uid");

-- CreateIndex
CREATE INDEX "computers_organization_id_idx" ON "computers"("organization_id");

-- CreateIndex
CREATE INDEX "computers_computer_uid_idx" ON "computers"("computer_uid");

-- CreateIndex
CREATE INDEX "computers_ip_address_idx" ON "computers"("ip_address");

-- CreateIndex
CREATE INDEX "computers_mac_address_idx" ON "computers"("mac_address");

-- CreateIndex
CREATE INDEX "actions_device_id_idx" ON "actions"("device_id");

-- CreateIndex
CREATE INDEX "actions_gate_id_idx" ON "actions"("gate_id");

-- CreateIndex
CREATE INDEX "actions_employee_id_idx" ON "actions"("employee_id");

-- CreateIndex
CREATE INDEX "actions_visitor_id_idx" ON "actions"("visitor_id");

-- CreateIndex
CREATE INDEX "actions_action_time_idx" ON "actions"("action_time");

-- CreateIndex
CREATE INDEX "actions_action_time_device_id_idx" ON "actions"("action_time", "device_id");

-- CreateIndex
CREATE INDEX "actions_action_time_employee_id_idx" ON "actions"("action_time", "employee_id");

-- CreateIndex
CREATE INDEX "actions_visitorType_idx" ON "actions"("visitorType");

-- CreateIndex
CREATE INDEX "actions_entryType_idx" ON "actions"("entryType");

-- CreateIndex
CREATE INDEX "actions_organization_id_idx" ON "actions"("organization_id");

-- CreateIndex
CREATE INDEX "gates_name_idx" ON "gates"("name");

-- CreateIndex
CREATE INDEX "devices_gate_id_idx" ON "devices"("gate_id");

-- CreateIndex
CREATE INDEX "devices_ip_address_idx" ON "devices"("ip_address");

-- CreateIndex
CREATE INDEX "devices_serial_number_idx" ON "devices"("serial_number");

-- CreateIndex
CREATE INDEX "devices_is_active_idx" ON "devices"("is_active");

-- CreateIndex
CREATE INDEX "attendances_start_time_end_time_idx" ON "attendances"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "attendances_employee_id_idx" ON "attendances"("employee_id");

-- CreateIndex
CREATE INDEX "attendances_organization_id_idx" ON "attendances"("organization_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_idx" ON "employees"("organization_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_department_id_idx" ON "employees"("organization_id", "department_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_policy_id_idx" ON "employees"("organization_id", "policy_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_is_active_idx" ON "employees"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE INDEX "jobs_uz_ru_eng_idx" ON "jobs"("uz", "ru", "eng");

-- CreateIndex
CREATE INDEX "credentials_employee_id_idx" ON "credentials"("employee_id");

-- CreateIndex
CREATE INDEX "credentials_code_idx" ON "credentials"("code");

-- CreateIndex
CREATE INDEX "credentials_type_idx" ON "credentials"("type");

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
CREATE INDEX "change_histories_organization_id_idx" ON "change_histories"("organization_id");

-- CreateIndex
CREATE INDEX "change_histories_user_id_idx" ON "change_histories"("user_id");

-- CreateIndex
CREATE INDEX "change_histories_table_name_idx" ON "change_histories"("table_name");

-- CreateIndex
CREATE INDEX "change_histories_created_at_idx" ON "change_histories"("created_at");

-- CreateIndex
CREATE INDEX "change_histories_user_id_table_name_idx" ON "change_histories"("user_id", "table_name");

-- CreateIndex
CREATE INDEX "change_histories_table_name_created_at_idx" ON "change_histories"("table_name", "created_at");

-- CreateIndex
CREATE INDEX "active_windows_organization_id_idx" ON "active_windows"("organization_id");

-- CreateIndex
CREATE INDEX "active_windows_computer_user_id_idx" ON "active_windows"("computer_user_id");

-- CreateIndex
CREATE INDEX "active_windows_computer_user_id_datetime_idx" ON "active_windows"("computer_user_id", "datetime");

-- CreateIndex
CREATE INDEX "active_windows_datetime_idx" ON "active_windows"("datetime");

-- CreateIndex
CREATE INDEX "active_windows_process_name_idx" ON "active_windows"("process_name");

-- CreateIndex
CREATE INDEX "visited_sites_organization_id_idx" ON "visited_sites"("organization_id");

-- CreateIndex
CREATE INDEX "visited_sites_computer_user_id_idx" ON "visited_sites"("computer_user_id");

-- CreateIndex
CREATE INDEX "visited_sites_computer_user_id_datetime_idx" ON "visited_sites"("computer_user_id", "datetime");

-- CreateIndex
CREATE INDEX "visited_sites_datetime_idx" ON "visited_sites"("datetime");

-- CreateIndex
CREATE INDEX "visited_sites_url_idx" ON "visited_sites"("url");

-- CreateIndex
CREATE INDEX "visited_sites_process_name_idx" ON "visited_sites"("process_name");

-- CreateIndex
CREATE INDEX "screenshots_computer_user_id_idx" ON "screenshots"("computer_user_id");

-- CreateIndex
CREATE INDEX "screenshots_computer_user_id_datetime_idx" ON "screenshots"("computer_user_id", "datetime");

-- CreateIndex
CREATE INDEX "screenshots_datetime_idx" ON "screenshots"("datetime");

-- CreateIndex
CREATE INDEX "screenshots_file_path_idx" ON "screenshots"("file_path");

-- CreateIndex
CREATE INDEX "user_sessions_organization_id_idx" ON "user_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "user_sessions_computer_user_id_idx" ON "user_sessions"("computer_user_id");

-- CreateIndex
CREATE INDEX "user_sessions_computer_user_id_start_time_idx" ON "user_sessions"("computer_user_id", "start_time");

-- CreateIndex
CREATE INDEX "user_sessions_start_time_idx" ON "user_sessions"("start_time");

-- CreateIndex
CREATE INDEX "user_sessions_session_type_idx" ON "user_sessions"("session_type");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_short_name_key" ON "organizations"("short_name");

-- CreateIndex
CREATE INDEX "departments_organization_id_idx" ON "departments"("organization_id");

-- CreateIndex
CREATE INDEX "departments_organization_id_parent_id_idx" ON "departments"("organization_id", "parent_id");

-- CreateIndex
CREATE INDEX "departments_organization_id_is_active_idx" ON "departments"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_short_name_key" ON "departments"("organization_id", "short_name");

-- CreateIndex
CREATE UNIQUE INDEX "policies_organization_id_title_key" ON "policies"("organization_id", "title");

-- CreateIndex
CREATE INDEX "policy_rules_policy_id_idx" ON "policy_rules"("policy_id");

-- CreateIndex
CREATE INDEX "policy_rules_resource_group_id_idx" ON "policy_rules"("resource_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_rules_policy_id_resource_group_id_type_key" ON "policy_rules"("policy_id", "resource_group_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "resource_groups_organization_id_name_type_key" ON "resource_groups"("organization_id", "name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "resources_organization_id_value_type_key" ON "resources"("organization_id", "value", "type");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "visitors_organization_id_idx" ON "visitors"("organization_id");

-- CreateIndex
CREATE INDEX "onetime_codes_organization_id_idx" ON "onetime_codes"("organization_id");

-- CreateIndex
CREATE INDEX "_ComputerToComputerUser_B_index" ON "_ComputerToComputerUser"("B");

-- CreateIndex
CREATE INDEX "_GateToOrganization_B_index" ON "_GateToOrganization"("B");

-- CreateIndex
CREATE INDEX "_EmployeeToGate_B_index" ON "_EmployeeToGate"("B");

-- CreateIndex
CREATE INDEX "_DepartmentToUser_B_index" ON "_DepartmentToUser"("B");

-- AddForeignKey
ALTER TABLE "computer_users" ADD CONSTRAINT "computer_users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computer_users" ADD CONSTRAINT "computer_users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computers" ADD CONSTRAINT "computers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "devices" ADD CONSTRAINT "devices_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "Reasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reasons" ADD CONSTRAINT "Reasons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_employeePlanId_fkey" FOREIGN KEY ("employeePlanId") REFERENCES "employee_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_syncs" ADD CONSTRAINT "employee_syncs_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "change_histories" ADD CONSTRAINT "change_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "resources" ADD CONSTRAINT "resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onetime_codes" ADD CONSTRAINT "onetime_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onetime_codes" ADD CONSTRAINT "onetime_codes_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ComputerToComputerUser" ADD CONSTRAINT "_ComputerToComputerUser_A_fkey" FOREIGN KEY ("A") REFERENCES "computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ComputerToComputerUser" ADD CONSTRAINT "_ComputerToComputerUser_B_fkey" FOREIGN KEY ("B") REFERENCES "computer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GateToOrganization" ADD CONSTRAINT "_GateToOrganization_A_fkey" FOREIGN KEY ("A") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GateToOrganization" ADD CONSTRAINT "_GateToOrganization_B_fkey" FOREIGN KEY ("B") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmployeeToGate" ADD CONSTRAINT "_EmployeeToGate_A_fkey" FOREIGN KEY ("A") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmployeeToGate" ADD CONSTRAINT "_EmployeeToGate_B_fkey" FOREIGN KEY ("B") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentToUser" ADD CONSTRAINT "_DepartmentToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentToUser" ADD CONSTRAINT "_DepartmentToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

