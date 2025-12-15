-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "credential_id" INTEGER;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
