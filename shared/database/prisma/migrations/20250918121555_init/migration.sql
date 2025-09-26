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
CREATE TYPE "public"."GroupType" AS ENUM ('USEFUL', 'UNUSEFUL');

-- CreateEnum
CREATE TYPE "public"."VisitorCodeType" AS ENUM ('ONETIME', 'MULTIPLE');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "organization_id" INTEGER,
    "department_id" INTEGER,
    "role" "public"."Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employees" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "policy_id" INTEGER,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "photo" TEXT,
    "additional_details" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credentials" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."ActionType" NOT NULL,
    "additional_details" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "computers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users_on_computers" (
    "id" SERIAL NOT NULL,
    "computer_user_id" INTEGER NOT NULL,
    "computer_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_on_computers_pkey" PRIMARY KEY ("id")
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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."devices" (
    "id" SERIAL NOT NULL,
    "gate_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "entry_type" "public"."EntryType" NOT NULL,
    "ip_address" TEXT NOT NULL,
    "login" TEXT,
    "password" TEXT,
    "welcome_text" TEXT,
    "welcome_text_type" "public"."WelcomeText" NOT NULL,
    "welcome_photo" TEXT,
    "welcome_photo_type" "public"."WelcomePhoto" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."screenshot_options" (
    "id" SERIAL NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 60,
    "is_grayscale" BOOLEAN NOT NULL DEFAULT false,
    "capture_all_window" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "screenshot_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."visited_sites_options" (
    "id" SERIAL NOT NULL,
    "useful_website_group_id" INTEGER,
    "unuseful_website_group_id" INTEGER,

    CONSTRAINT "visited_sites_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."active_windows_options" (
    "id" SERIAL NOT NULL,
    "useful_app_group_id" INTEGER,
    "unuseful_app_group_id" INTEGER,

    CONSTRAINT "active_windows_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policies" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "active_window" BOOLEAN NOT NULL DEFAULT true,
    "screenshot" BOOLEAN NOT NULL DEFAULT true,
    "visited_sites" BOOLEAN NOT NULL DEFAULT true,
    "screenshot_options_id" INTEGER,
    "visited_sites_options_id" INTEGER,
    "active_windows_options_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."websites" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."website_groups" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "group_type" "public"."GroupType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "website_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."websites_in_groups" (
    "website_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "websites_in_groups_pkey" PRIMARY KEY ("website_id","group_id")
);

-- CreateTable
CREATE TABLE "public"."apps" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."app_groups" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "group_type" "public"."GroupType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."apps_in_groups" (
    "app_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apps_in_groups_pkey" PRIMARY KEY ("app_id","group_id")
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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onetime_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."change_histories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "table_name" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "public"."users"("login");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_short_name_key" ON "public"."organizations"("short_name");

-- CreateIndex
CREATE UNIQUE INDEX "computer_users_sid_key" ON "public"."computer_users"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "computers_computer_uid_key" ON "public"."computers"("computer_uid");

-- CreateIndex
CREATE UNIQUE INDEX "websites_url_key" ON "public"."websites"("url");

-- CreateIndex
CREATE UNIQUE INDEX "apps_name_key" ON "public"."apps"("name");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credentials" ADD CONSTRAINT "credentials_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."computer_users" ADD CONSTRAINT "computer_users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users_on_computers" ADD CONSTRAINT "users_on_computers_computer_user_id_fkey" FOREIGN KEY ("computer_user_id") REFERENCES "public"."computer_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users_on_computers" ADD CONSTRAINT "users_on_computers_computer_id_fkey" FOREIGN KEY ("computer_id") REFERENCES "public"."computers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."active_windows" ADD CONSTRAINT "active_windows_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "public"."users_on_computers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visited_sites" ADD CONSTRAINT "visited_sites_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "public"."users_on_computers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."screenshots" ADD CONSTRAINT "screenshots_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "public"."users_on_computers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_users_on_computers_id_fkey" FOREIGN KEY ("users_on_computers_id") REFERENCES "public"."users_on_computers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."devices" ADD CONSTRAINT "devices_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visited_sites_options" ADD CONSTRAINT "visited_sites_options_useful_website_group_id_fkey" FOREIGN KEY ("useful_website_group_id") REFERENCES "public"."website_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visited_sites_options" ADD CONSTRAINT "visited_sites_options_unuseful_website_group_id_fkey" FOREIGN KEY ("unuseful_website_group_id") REFERENCES "public"."website_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."active_windows_options" ADD CONSTRAINT "active_windows_options_useful_app_group_id_fkey" FOREIGN KEY ("useful_app_group_id") REFERENCES "public"."app_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."active_windows_options" ADD CONSTRAINT "active_windows_options_unuseful_app_group_id_fkey" FOREIGN KEY ("unuseful_app_group_id") REFERENCES "public"."app_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_screenshot_options_id_fkey" FOREIGN KEY ("screenshot_options_id") REFERENCES "public"."screenshot_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_visited_sites_options_id_fkey" FOREIGN KEY ("visited_sites_options_id") REFERENCES "public"."visited_sites_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_active_windows_options_id_fkey" FOREIGN KEY ("active_windows_options_id") REFERENCES "public"."active_windows_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."websites_in_groups" ADD CONSTRAINT "websites_in_groups_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."websites_in_groups" ADD CONSTRAINT "websites_in_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."website_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."apps_in_groups" ADD CONSTRAINT "apps_in_groups_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."apps_in_groups" ADD CONSTRAINT "apps_in_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."app_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visitors" ADD CONSTRAINT "visitors_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."onetime_codes" ADD CONSTRAINT "onetime_codes_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."change_histories" ADD CONSTRAINT "change_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
