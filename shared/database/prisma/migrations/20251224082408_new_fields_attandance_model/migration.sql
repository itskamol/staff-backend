-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "planned_time" INTEGER;
