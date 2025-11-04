-- AddForeignKey
ALTER TABLE "public"."EmployeeSync" ADD CONSTRAINT "EmployeeSync_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployeeSync" ADD CONSTRAINT "EmployeeSync_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployeeSync" ADD CONSTRAINT "EmployeeSync_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
