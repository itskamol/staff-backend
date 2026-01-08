-- AlterTable
ALTER TABLE "visitors" ADD COLUMN     "attached_id" INTEGER;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_attached_id_fkey" FOREIGN KEY ("attached_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
