-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "onetime_code_id" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_onetime_code_id_fkey" FOREIGN KEY ("onetime_code_id") REFERENCES "onetime_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
