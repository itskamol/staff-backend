/*
  Warnings:

  - You are about to drop the column `organization_id` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the column `organization_id` on the `gates` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "devices" DROP CONSTRAINT "devices_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "gates" DROP CONSTRAINT "gates_organization_id_fkey";

-- DropIndex
DROP INDEX "devices_organization_id_idx";

-- DropIndex
DROP INDEX "gates_organization_id_idx";

-- AlterTable
ALTER TABLE "devices" DROP COLUMN "organization_id";

-- AlterTable
ALTER TABLE "gates" DROP COLUMN "organization_id";

-- CreateTable
CREATE TABLE "_GateToOrganization" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GateToOrganization_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GateToOrganization_B_index" ON "_GateToOrganization"("B");

-- AddForeignKey
ALTER TABLE "_GateToOrganization" ADD CONSTRAINT "_GateToOrganization_A_fkey" FOREIGN KEY ("A") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GateToOrganization" ADD CONSTRAINT "_GateToOrganization_B_fkey" FOREIGN KEY ("B") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
