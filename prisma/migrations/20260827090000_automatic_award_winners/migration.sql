-- AlterTable
ALTER TABLE "Award" ADD COLUMN "winnerRank" INTEGER;
ALTER TABLE "Event" ADD COLUMN "livePhase" INTEGER;

-- Mark the existing default awards as generated from the final funding ranking.
WITH candidates AS (
  SELECT
    "id",
    "eventId",
    CASE "name"
      WHEN '💰 Top Funded' THEN 1
      WHEN '🥈 Runner-Up' THEN 2
      WHEN '🥉 2nd Runner-Up' THEN 3
    END AS rank,
    ROW_NUMBER() OVER (
      PARTITION BY "eventId", "name"
      ORDER BY "index", "id"
    ) AS row_number
  FROM "Award"
  WHERE
    ("name" = '💰 Top Funded'
      AND "description" = 'The company that received the most investment from the crowd!'
      AND "votable" = true
      AND "index" = 1)
    OR ("name" = '🥈 Runner-Up'
      AND "description" = '2nd place!'
      AND "votable" = false
      AND "index" = 2)
    OR ("name" = '🥉 2nd Runner-Up'
      AND "description" = '3rd place!'
      AND "votable" = false
      AND "index" = 3)
)
UPDATE "Award" AS award
SET "winnerRank" = candidates.rank
FROM candidates
WHERE award."id" = candidates."id" AND candidates.row_number = 1;

-- One generated award can own each rank for an event.
CREATE UNIQUE INDEX "Award_eventId_winnerRank_key" ON "Award"("eventId", "winnerRank");
