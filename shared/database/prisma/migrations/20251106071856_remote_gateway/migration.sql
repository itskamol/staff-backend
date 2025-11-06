/*
  Warnings:

  - You are about to drop the `gateway_commands` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."gateway_commands";

-- DropEnum
DROP TYPE "public"."GatewayCommandAckStatus";

-- DropEnum
DROP TYPE "public"."GatewayCommandStatus";
