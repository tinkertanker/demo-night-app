-- AlterTable
ALTER TABLE "Feedback" DROP COLUMN "quickActions",
DROP COLUMN "tellMeMore",
ADD COLUMN     "cheers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "confetti" INTEGER NOT NULL DEFAULT 0;
