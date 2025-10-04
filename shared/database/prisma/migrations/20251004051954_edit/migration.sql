-- DropForeignKey
ALTER TABLE "public"."devices" DROP CONSTRAINT "devices_gate_id_fkey";

-- AlterTable
ALTER TABLE "public"."devices" ALTER COLUMN "gate_id" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "entry_type" DROP NOT NULL,
ALTER COLUMN "ip_address" DROP NOT NULL,
ALTER COLUMN "type" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."devices" ADD CONSTRAINT "devices_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
