/*
  Warnings:

  - You are about to drop the `policy_group_rules` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `screenshot_interval` on table `policies` required. This step will fail if there are existing NULL values in that column.
  - Made the column `screenshot_is_grayscale` on table `policies` required. This step will fail if there are existing NULL values in that column.
  - Made the column `screenshot_capture_all` on table `policies` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."RuleType" AS ENUM ('USEFUL', 'UNUSEFUL');

-- DropForeignKey
ALTER TABLE "public"."policy_group_rules" DROP CONSTRAINT "policy_group_rules_group_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."policy_group_rules" DROP CONSTRAINT "policy_group_rules_policy_id_fkey";

-- AlterTable
ALTER TABLE "public"."policies" ADD COLUMN     "created_by_id" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "updated_by_id" INTEGER,
ALTER COLUMN "screenshot_interval" SET NOT NULL,
ALTER COLUMN "screenshot_interval" SET DEFAULT 5,
ALTER COLUMN "screenshot_is_grayscale" SET NOT NULL,
ALTER COLUMN "screenshot_is_grayscale" SET DEFAULT false,
ALTER COLUMN "screenshot_capture_all" SET NOT NULL,
ALTER COLUMN "screenshot_capture_all" SET DEFAULT false;

-- DropTable
DROP TABLE "public"."policy_group_rules";

-- CreateTable
CREATE TABLE "public"."policy_options" (
    "id" SERIAL NOT NULL,
    "policy_id" INTEGER NOT NULL,
    "type" "public"."OptionType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rule_groups" (
    "id" SERIAL NOT NULL,
    "option_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "type" "public"."RuleType" NOT NULL,

    CONSTRAINT "rule_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policy_options_policy_id_type_idx" ON "public"."policy_options"("policy_id", "type");

-- CreateIndex
CREATE INDEX "policy_options_policy_id_is_active_idx" ON "public"."policy_options"("policy_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "policy_options_policy_id_type_key" ON "public"."policy_options"("policy_id", "type");

-- CreateIndex
CREATE INDEX "rule_groups_option_id_idx" ON "public"."rule_groups"("option_id");

-- CreateIndex
CREATE INDEX "rule_groups_group_id_idx" ON "public"."rule_groups"("group_id");

-- CreateIndex
CREATE INDEX "rule_groups_type_idx" ON "public"."rule_groups"("type");

-- CreateIndex
CREATE UNIQUE INDEX "rule_groups_option_id_group_id_type_key" ON "public"."rule_groups"("option_id", "group_id", "type");

-- CreateIndex
CREATE INDEX "policies_organization_id_title_idx" ON "public"."policies"("organization_id", "title");

-- CreateIndex
CREATE INDEX "policies_created_at_idx" ON "public"."policies"("created_at");

-- AddForeignKey
ALTER TABLE "public"."policy_options" ADD CONSTRAINT "policy_options_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rule_groups" ADD CONSTRAINT "rule_groups_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."policy_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rule_groups" ADD CONSTRAINT "rule_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."resource_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
