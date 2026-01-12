-- CreateTable
CREATE TABLE "_GateToVisitor" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GateToVisitor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GateToVisitor_B_index" ON "_GateToVisitor"("B");

-- AddForeignKey
ALTER TABLE "_GateToVisitor" ADD CONSTRAINT "_GateToVisitor_A_fkey" FOREIGN KEY ("A") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GateToVisitor" ADD CONSTRAINT "_GateToVisitor_B_fkey" FOREIGN KEY ("B") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
