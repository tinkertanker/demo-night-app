-- Live presentation state moves from Redis/KV into Postgres.
CREATE TABLE "LiveEvent" (
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "currentDemoId" TEXT,
    "currentAwardId" TEXT,
    "isPitchNight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveEvent_pkey" PRIMARY KEY ("eventId")
);

ALTER TABLE "LiveEvent" ADD CONSTRAINT "LiveEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
