-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('ON_TIME', 'LATE');

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "status" "ActionStatus";

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "employeePlanId" INTEGER;

-- CreateTable
CREATE TABLE "EmployeePlan" (
    "id" SERIAL NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "extraTime" TEXT NOT NULL,
    "weekdays" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EmployeePlan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_employeePlanId_fkey" FOREIGN KEY ("employeePlanId") REFERENCES "EmployeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
