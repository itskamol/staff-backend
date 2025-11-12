-- CreateTable
CREATE TABLE "GateEmployee" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "gateId" INTEGER NOT NULL,

    CONSTRAINT "GateEmployee_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GateEmployee" ADD CONSTRAINT "GateEmployee_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateEmployee" ADD CONSTRAINT "GateEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
