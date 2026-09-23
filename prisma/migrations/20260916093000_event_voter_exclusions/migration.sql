-- CreateTable
CREATE TABLE "_ExcludedVoters" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ExcludedVoters_AB_unique" ON "_ExcludedVoters"("A", "B");

-- CreateIndex
CREATE INDEX "_ExcludedVoters_B_index" ON "_ExcludedVoters"("B");

-- AddForeignKey
ALTER TABLE "_ExcludedVoters" ADD CONSTRAINT "_ExcludedVoters_A_fkey" FOREIGN KEY ("A") REFERENCES "Attendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExcludedVoters" ADD CONSTRAINT "_ExcludedVoters_B_fkey" FOREIGN KEY ("B") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
