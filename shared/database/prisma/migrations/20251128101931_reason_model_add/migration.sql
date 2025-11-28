-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "reason_id" INTEGER;

-- CreateTable
CREATE TABLE "Reasons" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "organization_id" INTEGER NOT NULL,

    CONSTRAINT "Reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reasons_key_organization_id_key" ON "Reasons"("key", "organization_id");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "Reasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reasons" ADD CONSTRAINT "Reasons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
