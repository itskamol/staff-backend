-- AlterTable
ALTER TABLE "public"."devices" ADD COLUMN     "firmware" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "serial_number" TEXT;
