import { type PrismaClient } from "@prisma/client";

// Legacy scheduled cleanup, retained without changing its schedule or cutoff.
// Application clients no longer read/write these columns (@ignore). The separate
// post-deployment purge removes all remaining contacts, regardless of event age.
export const EMAIL_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// Event.date is the event day's Singapore midnight (the schema has no end
// date), so emails go at that midnight plus 30 days.
export function emailScrubCutoff(now: Date) {
  return new Date(now.getTime() - EMAIL_RETENTION_DAYS * DAY_MS);
}

// Idempotent: only rows that still hold an email are updated, so a rerun
// returns zero counts.
export async function scrubExpiredEmails(
  prisma: PrismaClient,
  now = new Date(),
) {
  const cutoff = emailScrubCutoff(now);
  const [submissions, demos, attendees] = await prisma.$transaction([
    prisma.$executeRaw`UPDATE "Submission" SET email = NULL
      WHERE email IS NOT NULL AND "eventId" IN
        (SELECT id FROM "Event" WHERE date <= ${cutoff})`,
    prisma.$executeRaw`UPDATE "Demo" SET email = NULL
      WHERE email IS NOT NULL AND "eventId" IN
        (SELECT id FROM "Event" WHERE date <= ${cutoff})`,
    prisma.$executeRaw`UPDATE "Attendee" a SET email = NULL
      WHERE email IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "_AttendeeToEvent" ae JOIN "Event" e ON e.id = ae."B"
        WHERE ae."A" = a.id AND e.date > ${cutoff}
      )`,
  ]);
  return {
    submissions,
    demos,
    attendees,
  };
}
