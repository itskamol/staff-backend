/*
  Warnings:

  - You are about to drop the column `department_id` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."users" DROP CONSTRAINT "users_department_id_fkey";

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "department_id";

-- CreateTable
CREATE TABLE "public"."department_users" (
    "user_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,

    CONSTRAINT "department_users_pkey" PRIMARY KEY ("user_id","department_id")
);

-- AddForeignKey
ALTER TABLE "public"."department_users" ADD CONSTRAINT "department_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_users" ADD CONSTRAINT "department_users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
