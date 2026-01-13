/*
  Warnings:

  - You are about to drop the `_DeviceToVisitor` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_DeviceToVisitor" DROP CONSTRAINT "_DeviceToVisitor_A_fkey";

-- DropForeignKey
ALTER TABLE "_DeviceToVisitor" DROP CONSTRAINT "_DeviceToVisitor_B_fkey";

-- AlterTable
ALTER TABLE "visitors" ADD COLUMN     "gate_id" INTEGER;

-- DropTable
DROP TABLE "_DeviceToVisitor";

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
