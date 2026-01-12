/*
  Warnings:

  - You are about to drop the `_EmployeeToGate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_GateToVisitor` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_EmployeeToGate" DROP CONSTRAINT "_EmployeeToGate_A_fkey";

-- DropForeignKey
ALTER TABLE "_EmployeeToGate" DROP CONSTRAINT "_EmployeeToGate_B_fkey";

-- DropForeignKey
ALTER TABLE "_GateToVisitor" DROP CONSTRAINT "_GateToVisitor_A_fkey";

-- DropForeignKey
ALTER TABLE "_GateToVisitor" DROP CONSTRAINT "_GateToVisitor_B_fkey";

-- DropTable
DROP TABLE "_EmployeeToGate";

-- DropTable
DROP TABLE "_GateToVisitor";

-- CreateTable
CREATE TABLE "_DeviceToEmployee" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DeviceToEmployee_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DeviceToVisitor" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DeviceToVisitor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DeviceToEmployee_B_index" ON "_DeviceToEmployee"("B");

-- CreateIndex
CREATE INDEX "_DeviceToVisitor_B_index" ON "_DeviceToVisitor"("B");

-- AddForeignKey
ALTER TABLE "_DeviceToEmployee" ADD CONSTRAINT "_DeviceToEmployee_A_fkey" FOREIGN KEY ("A") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceToEmployee" ADD CONSTRAINT "_DeviceToEmployee_B_fkey" FOREIGN KEY ("B") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceToVisitor" ADD CONSTRAINT "_DeviceToVisitor_A_fkey" FOREIGN KEY ("A") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceToVisitor" ADD CONSTRAINT "_DeviceToVisitor_B_fkey" FOREIGN KEY ("B") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
