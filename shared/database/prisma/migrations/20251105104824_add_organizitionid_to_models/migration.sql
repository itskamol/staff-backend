-- AlterTable
ALTER TABLE "EmployeePlan" ADD COLUMN     "organization_id" INTEGER;

-- AlterTable
ALTER TABLE "EmployeeSync" ADD COLUMN     "organization_id" INTEGER;

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "organization_id" INTEGER;

-- AlterTable
ALTER TABLE "credentials" ADD COLUMN     "organization_id" INTEGER;

-- AlterTable
ALTER TABLE "gates" ADD COLUMN     "organization_id" INTEGER;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSync" ADD CONSTRAINT "EmployeeSync_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePlan" ADD CONSTRAINT "EmployeePlan_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
