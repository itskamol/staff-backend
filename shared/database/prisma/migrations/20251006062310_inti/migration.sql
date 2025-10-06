-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'HR', 'DEPARTMENT_LEAD', 'GUARD');

-- CreateEnum
CREATE TYPE "public"."EntryType" AS ENUM ('ENTER', 'EXIT', 'BOTH');

-- CreateEnum
CREATE TYPE "public"."ActionType" AS ENUM ('PHOTO', 'CARD', 'CAR', 'QR', 'PERSONAL_CODE', 'ONE_TIME_ID', 'USER');

-- CreateEnum
CREATE TYPE "public"."WelcomeText" AS ENUM ('NO_TEXT', 'CUSTOM_TEXT', 'EMPLOYEE_NAME');

-- CreateEnum
CREATE TYPE "public"."WelcomePhoto" AS ENUM ('NO_PHOTO', 'CUSTOM_PHOTO', 'EMPLOYEE_PHOTO');

-- CreateEnum
CREATE TYPE "public"."VisitorType" AS ENUM ('EMPLOYEE', 'VISITOR');

-- CreateEnum
CREATE TYPE "public"."ActionMode" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "public"."SessionType" AS ENUM ('UNLOCKED', 'LOCKED', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "public"."OptionType" AS ENUM ('WEBSITE', 'ACTIVE_WINDOW');

-- CreateEnum
CREATE TYPE "public"."ResourceType" AS ENUM ('WEBSITE', 'APPLICATION');

-- CreateEnum
CREATE TYPE "public"."VisitorCodeType" AS ENUM ('ONETIME', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "public"."DeviceType" AS ENUM ('FACE', 'CARD', 'CAR', 'QR', 'ACCESS_CONTROL', 'BIOMETRIC', 'OTHER');

-- CreateTable
CREATE TABLE "public"."computer_users" (
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

    CONSTRAINT "computer_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."computers" (
    "id" SERIAL NOT NULL,
    "computer_uid" TEXT NOT NULL,
    "os" TEXT,
    "ip_address" TEXT,
    "mac_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "computers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users_on_computers" (
    "id" SERIAL NOT NULL,
    "computer_user_id" INTEGER NOT NULL,
    "computer_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_on_computers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."actions" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER,
    "gate_id" INTEGER,
    "action_time" TIMESTAMP(3) NOT NULL,
    "employee_id" INTEGER,
    "visitor_id" INTEGER,
    "visitorType" "public"."VisitorType" NOT NULL,
    "entryType" "public"."EntryType" NOT NULL,
    "actionType" "public"."ActionType" NOT NULL,
    "action_result" TEXT,
    "actionMode" "public"."ActionMode" NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."devices" (
    "id" SERIAL NOT NULL,
    "gate_id" INTEGER,
    "name" TEXT,
    "entry_type" "public"."EntryType",
    "type" "public"."DeviceType",
    "manufacturer" TEXT,
    "model" TEXT,
    "firmware" TEXT,
    "serial_number" TEXT,
    "ip_address" TEXT,
    "login" TEXT,
    "password" TEXT,
    "welcome_text" TEXT,
    "welcome_text_type" "public"."WelcomeText",
    "welcome_photo" TEXT,
    "welcome_photo_type" "public"."WelcomePhoto",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employees" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "photo" TEXT,
    "additional_details" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_groups" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "policyId" INTEGER,

    CONSTRAINT "employee_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credentials" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."ActionType" NOT NULL,
    "additional_details" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."change_histories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "table_name" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."active_windows" (
    "id" SERIAL NOT NULL,
    "users_on_computers_id" INTEGER NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "icon" TEXT,
    "active_time" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."visited_sites" (
    "id" SERIAL NOT NULL,
    "users_on_computers_id" INTEGER NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "icon" TEXT,
    "active_time" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visited_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."screenshots" (
    "id" SERIAL NOT NULL,
    "users_on_computers_id" INTEGER NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "file_path" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "icon" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" SERIAL NOT NULL,
    "users_on_computers_id" INTEGER NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "session_type" "public"."SessionType" NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organizations" (
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

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."departments" (
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

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policies" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "active_window" BOOLEAN NOT NULL DEFAULT true,
    "screenshot" BOOLEAN NOT NULL DEFAULT true,
    "visited_sites" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "screenshot_interval" INTEGER,
    "screenshot_is_grayscale" BOOLEAN,
    "screenshot_capture_all" BOOLEAN,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_group_rules" (
    "id" SERIAL NOT NULL,
    "policy_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "type" "public"."OptionType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_group_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resource_group" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ResourceType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resource_groups" (
    "id" SERIAL NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resources" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "type" "public"."ResourceType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "organization_id" INTEGER,
    "role" "public"."Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."department_users" (
    "user_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,

    CONSTRAINT "department_users_pkey" PRIMARY KEY ("user_id","department_id")
);

-- CreateTable
CREATE TABLE "public"."visitors" (
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

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."onetime_codes" (
    "id" SERIAL NOT NULL,
    "visitor_id" INTEGER NOT NULL,
    "code_type" "public"."VisitorCodeType" NOT NULL,
    "code" TEXT NOT NULL,
    "additional_details" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onetime_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "computer_users_sid_key" ON "public"."computer_users"("sid");

-- CreateIndex
CREATE INDEX "computer_users_employee_id_idx" ON "public"."computer_users"("employee_id");

-- CreateIndex
CREATE INDEX "computer_users_sid_idx" ON "public"."computer_users"("sid");

-- CreateIndex
CREATE INDEX "computer_users_username_idx" ON "public"."computer_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "computers_computer_uid_key" ON "public"."computers"("computer_uid");

-- CreateIndex
CREATE INDEX "computers_computer_uid_idx" ON "public"."computers"("computer_uid");

-- CreateIndex
CREATE INDEX "computers_ip_address_idx" ON "public"."computers"("ip_address");

-- CreateIndex
CREATE INDEX "computers_mac_address_idx" ON "public"."computers"("mac_address");

-- CreateIndex
CREATE INDEX "users_on_computers_computer_user_id_idx" ON "public"."users_on_computers"("computer_user_id");

-- CreateIndex
CREATE INDEX "users_on_computers_computer_id_idx" ON "public"."users_on_computers"("computer_id");

-- CreateIndex
CREATE INDEX "users_on_computers_is_active_idx" ON "public"."users_on_computers"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "users_on_computers_computer_user_id_computer_id_key" ON "public"."users_on_computers"("computer_user_id", "computer_id");

-- CreateIndex
CREATE INDEX "actions_device_id_idx" ON "public"."actions"("device_id");

-- CreateIndex
CREATE INDEX "actions_gate_id_idx" ON "public"."actions"("gate_id");

-- CreateIndex
CREATE INDEX "actions_employee_id_idx" ON "public"."actions"("employee_id");

-- CreateIndex
CREATE INDEX "actions_visitor_id_idx" ON "public"."actions"("visitor_id");

-- CreateIndex
CREATE INDEX "actions_action_time_idx" ON "public"."actions"("action_time");

-- CreateIndex
CREATE INDEX "actions_action_time_device_id_idx" ON "public"."actions"("action_time", "device_id");

-- CreateIndex
CREATE INDEX "actions_action_time_employee_id_idx" ON "public"."actions"("action_time", "employee_id");

-- CreateIndex
CREATE INDEX "actions_visitorType_idx" ON "public"."actions"("visitorType");

-- CreateIndex
CREATE INDEX "actions_entryType_idx" ON "public"."actions"("entryType");

-- CreateIndex
CREATE INDEX "gates_name_idx" ON "public"."gates"("name");

-- CreateIndex
CREATE INDEX "devices_gate_id_idx" ON "public"."devices"("gate_id");

-- CreateIndex
CREATE INDEX "devices_ip_address_idx" ON "public"."devices"("ip_address");

-- CreateIndex
CREATE INDEX "devices_serial_number_idx" ON "public"."devices"("serial_number");

-- CreateIndex
CREATE INDEX "devices_is_active_idx" ON "public"."devices"("is_active");

-- CreateIndex
CREATE INDEX "employees_organization_id_idx" ON "public"."employees"("organization_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_department_id_idx" ON "public"."employees"("organization_id", "department_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_group_id_idx" ON "public"."employees"("organization_id", "group_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_is_active_idx" ON "public"."employees"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "public"."employees"("email");

-- CreateIndex
CREATE INDEX "employee_groups_organization_id_idx" ON "public"."employee_groups"("organization_id");

-- CreateIndex
CREATE INDEX "employee_groups_organization_id_is_active_idx" ON "public"."employee_groups"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "employee_groups_organization_id_is_default_idx" ON "public"."employee_groups"("organization_id", "is_default");

-- CreateIndex
CREATE INDEX "employee_groups_policyId_idx" ON "public"."employee_groups"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_groups_organization_id_name_key" ON "public"."employee_groups"("organization_id", "name");

-- CreateIndex
CREATE INDEX "credentials_employee_id_idx" ON "public"."credentials"("employee_id");

-- CreateIndex
CREATE INDEX "credentials_code_idx" ON "public"."credentials"("code");

-- CreateIndex
CREATE INDEX "credentials_type_idx" ON "public"."credentials"("type");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_employee_id_code_type_key" ON "public"."credentials"("employee_id", "code", "type");

-- CreateIndex
CREATE INDEX "change_histories_user_id_idx" ON "public"."change_histories"("user_id");

-- CreateIndex
CREATE INDEX "change_histories_table_name_idx" ON "public"."change_histories"("table_name");

-- CreateIndex
CREATE INDEX "change_histories_created_at_idx" ON "public"."change_histories"("created_at");

-- CreateIndex
CREATE INDEX "change_histories_user_id_table_name_idx" ON "public"."change_histories"("user_id", "table_name");

-- CreateIndex
CREATE INDEX "change_histories_table_name_created_at_idx" ON "public"."change_histories"("table_name", "created_at");

-- CreateIndex
CREATE INDEX "active_windows_users_on_computers_id_idx" ON "public"."active_windows"("users_on_computers_id");

-- CreateIndex
CREATE INDEX "active_windows_users_on_computers_id_datetime_idx" ON "public"."active_windows"("users_on_computers_id", "datetime");

-- CreateIndex
CREATE INDEX "active_windows_datetime_idx" ON "public"."active_windows"("datetime");

-- CreateIndex
CREATE INDEX "active_windows_process_name_idx" ON "public"."active_windows"("process_name");

-- CreateIndex
CREATE INDEX "visited_sites_users_on_computers_id_idx" ON "public"."visited_sites"("users_on_computers_id");

-- CreateIndex
CREATE INDEX "visited_sites_users_on_computers_id_datetime_idx" ON "public"."visited_sites"("users_on_computers_id", "datetime");

-- CreateIndex
CREATE INDEX "visited_sites_datetime_idx" ON "public"."visited_sites"("datetime");

-- CreateIndex
CREATE INDEX "visited_sites_url_idx" ON "public"."visited_sites"("url");

-- CreateIndex
CREATE INDEX "visited_sites_process_name_idx" ON "public"."visited_sites"("process_name");

-- CreateIndex
CREATE INDEX "screenshots_users_on_computers_id_idx" ON "public"."screenshots"("users_on_computers_id");

-- CreateIndex
CREATE INDEX "screenshots_users_on_computers_id_datetime_idx" ON "public"."screenshots"("users_on_computers_id", "datetime");

-- CreateIndex
CREATE INDEX "screenshots_datetime_idx" ON "public"."screenshots"("datetime");

-- CreateIndex
CREATE INDEX "screenshots_file_path_idx" ON "public"."screenshots"("file_path");

-- CreateIndex
CREATE INDEX "user_sessions_users_on_computers_id_idx" ON "public"."user_sessions"("users_on_computers_id");

-- CreateIndex
CREATE INDEX "user_sessions_users_on_computers_id_start_time_idx" ON "public"."user_sessions"("users_on_computers_id", "start_time");

-- CreateIndex
CREATE INDEX "user_sessions_start_time_idx" ON "public"."user_sessions"("start_time");

-- CreateIndex
CREATE INDEX "user_sessions_session_type_idx" ON "public"."user_sessions"("session_type");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_short_name_key" ON "public"."organizations"("short_name");

-- CreateIndex
CREATE INDEX "departments_organization_id_idx" ON "public"."departments"("organization_id");

-- CreateIndex
CREATE INDEX "departments_organization_id_parent_id_idx" ON "public"."departments"("organization_id", "parent_id");

-- CreateIndex
CREATE INDEX "departments_organization_id_is_active_idx" ON "public"."departments"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_full_name_key" ON "public"."departments"("organization_id", "full_name");

-- CreateIndex
CREATE INDEX "policies_organization_id_idx" ON "public"."policies"("organization_id");

-- CreateIndex
CREATE INDEX "policies_organization_id_is_active_idx" ON "public"."policies"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "policies_organization_id_is_default_idx" ON "public"."policies"("organization_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "policies_organization_id_title_key" ON "public"."policies"("organization_id", "title");

-- CreateIndex
CREATE UNIQUE INDEX "policy_group_rules_policy_id_group_id_key" ON "public"."policy_group_rules"("policy_id", "group_id");

-- CreateIndex
CREATE INDEX "resource_group_organization_id_idx" ON "public"."resource_group"("organization_id");

-- CreateIndex
CREATE INDEX "resource_group_organization_id_type_idx" ON "public"."resource_group"("organization_id", "type");

-- CreateIndex
CREATE INDEX "resource_group_organization_id_is_active_idx" ON "public"."resource_group"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "resource_group_organization_id_name_type_key" ON "public"."resource_group"("organization_id", "name", "type");

-- CreateIndex
CREATE INDEX "resources_organization_id_idx" ON "public"."resources"("organization_id");

-- CreateIndex
CREATE INDEX "resources_organization_id_type_idx" ON "public"."resources"("organization_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "resources_organization_id_value_type_key" ON "public"."resources"("organization_id", "value", "type");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "public"."users"("organization_id");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "public"."users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE INDEX "users_organization_id_role_idx" ON "public"."users"("organization_id", "role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "public"."users"("is_active");

-- CreateIndex
CREATE INDEX "department_users_user_id_idx" ON "public"."department_users"("user_id");

-- CreateIndex
CREATE INDEX "department_users_department_id_idx" ON "public"."department_users"("department_id");

-- CreateIndex
CREATE INDEX "visitors_creator_id_idx" ON "public"."visitors"("creator_id");

-- CreateIndex
CREATE INDEX "visitors_phone_idx" ON "public"."visitors"("phone");

-- CreateIndex
CREATE INDEX "visitors_passport_number_idx" ON "public"."visitors"("passport_number");

-- CreateIndex
CREATE INDEX "visitors_pinfl_idx" ON "public"."visitors"("pinfl");

-- CreateIndex
CREATE INDEX "visitors_is_active_idx" ON "public"."visitors"("is_active");

-- CreateIndex
CREATE INDEX "visitors_created_at_idx" ON "public"."visitors"("created_at");

-- CreateIndex
CREATE INDEX "onetime_codes_visitor_id_idx" ON "public"."onetime_codes"("visitor_id");

-- CreateIndex
CREATE INDEX "onetime_codes_code_idx" ON "public"."onetime_codes"("code");

-- CreateIndex
CREATE INDEX "onetime_codes_start_date_end_date_idx" ON "public"."onetime_codes"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "onetime_codes_is_active_idx" ON "public"."onetime_codes"("is_active");

-- AddForeignKey
ALTER TABLE "public"."computer_users" ADD CONSTRAINT "computer_users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users_on_computers" ADD CONSTRAINT "users_on_computers_computer_user_id_fkey" FOREIGN KEY ("computer_user_id") REFERENCES "public"."computer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users_on_computers" ADD CONSTRAINT "users_on_computers_computer_id_fkey" FOREIGN KEY ("computer_id") REFERENCES "public"."computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."devices" ADD CONSTRAINT "devices_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."employee_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_groups" ADD CONSTRAINT "employee_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_groups" ADD CONSTRAINT "employee_groups_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credentials" ADD CONSTRAINT "credentials_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."change_histories" ADD CONSTRAINT "change_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."active_windows" ADD CONSTRAINT "active_windows_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "public"."users_on_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visited_sites" ADD CONSTRAINT "visited_sites_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "public"."users_on_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."screenshots" ADD CONSTRAINT "screenshots_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "public"."users_on_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "public"."users_on_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_group_rules" ADD CONSTRAINT "policy_group_rules_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_group_rules" ADD CONSTRAINT "policy_group_rules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."resource_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resource_group" ADD CONSTRAINT "resource_group_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resource_groups" ADD CONSTRAINT "resource_groups_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resource_groups" ADD CONSTRAINT "resource_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."resource_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resources" ADD CONSTRAINT "resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_users" ADD CONSTRAINT "department_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_users" ADD CONSTRAINT "department_users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visitors" ADD CONSTRAINT "visitors_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."onetime_codes" ADD CONSTRAINT "onetime_codes_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
