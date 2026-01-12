-- AlterTable
ALTER TABLE "employee_syncs" ADD COLUMN     "visitor_id" INTEGER,
ALTER COLUMN "employee_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "employee_syncs" ADD CONSTRAINT "employee_syncs_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
