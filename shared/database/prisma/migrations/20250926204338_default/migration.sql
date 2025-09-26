-- AlterTable
ALTER TABLE "public"."app_groups" ADD COLUMN     "default" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."policies" ADD COLUMN     "default" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."website_groups" ADD COLUMN     "default" BOOLEAN NOT NULL DEFAULT false;
