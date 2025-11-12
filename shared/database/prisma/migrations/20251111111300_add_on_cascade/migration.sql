-- DropForeignKey
ALTER TABLE "public"."EmployeeSync" DROP CONSTRAINT "EmployeeSync_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmployeeSync" DROP CONSTRAINT "EmployeeSync_gateId_fkey";

-- AddForeignKey
ALTER TABLE "EmployeeSync" ADD CONSTRAINT "EmployeeSync_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSync" ADD CONSTRAINT "EmployeeSync_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
