/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,gateId]` on the table `GateEmployee` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GateEmployee_employeeId_gateId_key" ON "GateEmployee"("employeeId", "gateId");
