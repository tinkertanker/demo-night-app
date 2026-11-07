-- Prisma 6 gives implicit many-to-many tables a composite primary key
-- instead of a unique index. The existing unique indexes already prevent
-- duplicate pairs; the deletes only guard databases where that index was
-- missing, so adding the primary key cannot fail on duplicates.

-- AlterTable
DELETE FROM "_AttendeeToEvent" a USING "_AttendeeToEvent" b
WHERE a.ctid < b.ctid AND a."A" = b."A" AND a."B" = b."B";
ALTER TABLE "_AttendeeToEvent" ADD CONSTRAINT "_AttendeeToEvent_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_AttendeeToEvent_AB_unique";

-- AlterTable
DELETE FROM "_ExcludedVoters" a USING "_ExcludedVoters" b
WHERE a.ctid < b.ctid AND a."A" = b."A" AND a."B" = b."B";
ALTER TABLE "_ExcludedVoters" ADD CONSTRAINT "_ExcludedVoters_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ExcludedVoters_AB_unique";
