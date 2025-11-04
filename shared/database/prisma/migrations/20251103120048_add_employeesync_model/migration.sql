-- CreateEnum
CREATE TYPE "public"."StatusEnum" AS ENUM ('INP', 'DONE', 'ERROR');

-- CreateTable
CREATE TABLE "public"."EmployeeSync" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "gateId" INTEGER NOT NULL,
    "status" "public"."StatusEnum" NOT NULL DEFAULT 'INP',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSync_pkey" PRIMARY KEY ("id")
);
