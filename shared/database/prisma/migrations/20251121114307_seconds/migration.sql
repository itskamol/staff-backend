/*
  Warnings:

  - Added the required column `end_time_in_seconds` to the `employee_plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `extra_time_in_seconds` to the `employee_plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_time_in_seconds` to the `employee_plans` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "employee_plans" ADD COLUMN     "end_time_in_seconds" INTEGER NOT NULL,
ADD COLUMN     "extra_time_in_seconds" INTEGER NOT NULL,
ADD COLUMN     "start_time_in_seconds" INTEGER NOT NULL;
