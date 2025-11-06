-- DropForeignKey
ALTER TABLE "public"."EmployeeSync" DROP CONSTRAINT "EmployeeSync_employeeId_fkey";

-- AddForeignKey
ALTER TABLE "EmployeeSync" ADD CONSTRAINT "EmployeeSync_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
