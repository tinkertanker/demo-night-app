import { type PrismaClient } from "@prisma/client";

// Presenter and attendee emails are kept for event logistics only and cleared
// this many days after the event. Admin and sign-in (User) emails are kept.
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
  const expired = { date: { lte: emailScrubCutoff(now) } };
  const [submissions, demos, attendees] = await prisma.$transaction([
    prisma.submission.updateMany({
      where: { email: { not: null }, event: expired },
      data: { email: null },
    }),
    prisma.demo.updateMany({
      where: { email: { not: null }, event: expired },
      data: { email: null },
    }),
    // Attendees belong to one event each (older ones to several); clear once
    // every event is past, including attendees whose events were deleted.
    prisma.attendee.updateMany({
      where: { email: { not: null }, events: { every: expired } },
      data: { email: null },
    }),
  ]);
  return {
    submissions: submissions.count,
    demos: demos.count,
    attendees: attendees.count,
  };
}
