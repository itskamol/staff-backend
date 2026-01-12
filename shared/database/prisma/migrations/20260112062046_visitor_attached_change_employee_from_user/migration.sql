-- DropForeignKey
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_attached_id_fkey";

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_attached_id_fkey" FOREIGN KEY ("attached_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
