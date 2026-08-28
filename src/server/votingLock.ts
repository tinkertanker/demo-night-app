import { type Prisma } from "@prisma/client";

const CURRENT_EVENT_STATE_LOCK_ID = 6_463_656_679_425_217n;

export async function lockCurrentEventState(prisma: Prisma.TransactionClient) {
  await prisma.$queryRaw`
    SELECT pg_advisory_xact_lock(${CURRENT_EVENT_STATE_LOCK_ID}) IS NULL AS "locked"
  `;
}

export async function lockVotingEvent(
  prisma: Prisma.TransactionClient,
  eventId: string,
) {
  await prisma.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${eventId}, 0)) IS NULL AS "locked"
  `;
}
