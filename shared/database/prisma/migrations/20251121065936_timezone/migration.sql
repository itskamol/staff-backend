/*
  Warnings:

  - You are about to drop the column `resource_group_id` on the `policy_rules` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "policy_rules" DROP CONSTRAINT "policy_rules_resource_group_id_fkey";

-- DropIndex
DROP INDEX "policy_rules_policy_id_resource_group_id_type_key";

-- DropIndex
DROP INDEX "policy_rules_resource_group_id_idx";

-- AlterTable
ALTER TABLE "policy_rules" DROP COLUMN "resource_group_id";

-- CreateTable
CREATE TABLE "_PolicyRuleToResourceGroup" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PolicyRuleToResourceGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PolicyRuleToResourceGroup_B_index" ON "_PolicyRuleToResourceGroup"("B");

-- AddForeignKey
ALTER TABLE "_PolicyRuleToResourceGroup" ADD CONSTRAINT "_PolicyRuleToResourceGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "policy_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PolicyRuleToResourceGroup" ADD CONSTRAINT "_PolicyRuleToResourceGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "resource_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
