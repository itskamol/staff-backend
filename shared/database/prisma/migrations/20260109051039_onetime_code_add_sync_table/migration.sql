-- AlterTable
ALTER TABLE "employee_syncs" ADD COLUMN     "onetime_code_id" INTEGER;

-- AddForeignKey
ALTER TABLE "employee_syncs" ADD CONSTRAINT "employee_syncs_onetime_code_id_fkey" FOREIGN KEY ("onetime_code_id") REFERENCES "onetime_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
