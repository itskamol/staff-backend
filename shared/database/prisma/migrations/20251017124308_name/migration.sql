/*
  Warnings:

  - The primary key for the `gateway_commands` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "public"."gateway_commands" DROP CONSTRAINT "gateway_commands_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "sent_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "ack_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "gateway_commands_pkey" PRIMARY KEY ("id");

-- RenameIndex
ALTER INDEX "public"."idx_gateway_commands_created_at" RENAME TO "gateway_commands_created_at_idx";

-- RenameIndex
ALTER INDEX "public"."idx_gateway_commands_gateway_status" RENAME TO "gateway_commands_gateway_id_status_idx";
