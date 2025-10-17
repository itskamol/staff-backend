CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "GatewayCommandStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'FAILED');
CREATE TYPE "GatewayCommandAckStatus" AS ENUM ('ACCEPTED', 'REJECTED');

CREATE TABLE "gateway_commands" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "gateway_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "requires_ack" BOOLEAN NOT NULL DEFAULT TRUE,
    "status" "GatewayCommandStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "sent_at" TIMESTAMPTZ,
    "ack_at" TIMESTAMPTZ,
    "ack_status" "GatewayCommandAckStatus",
    "ack_error" TEXT
);

CREATE INDEX "idx_gateway_commands_gateway_status" ON "gateway_commands" ("gateway_id", "status");
CREATE INDEX "idx_gateway_commands_created_at" ON "gateway_commands" ("created_at");
