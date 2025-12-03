-- AlterTable
ALTER TABLE "employee_syncs" ADD COLUMN     "credential_id" INTEGER;

-- AddForeignKey
ALTER TABLE "employee_syncs" ADD CONSTRAINT "employee_syncs_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
