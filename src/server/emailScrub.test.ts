import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { db } from "~/server/db";
import { scrubExpiredEmails } from "~/server/emailScrub";

// Runs the real scrub against the local database. It updates every expired row
// there, so it refuses remote databases.
assert.ok(
  ["localhost", "127.0.0.1", "::1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
  "Email scrub tests require a local database",
);

const DAY_MS = 24 * 60 * 60 * 1000;
const prefix = `scrub-test-${crypto.randomUUID()}`;
// A fixed moment, so the fixtures sit either side of the 30-day boundary.
const now = new Date("2031-03-15T04:00:00.000Z");
const email = (name: string) => `${prefix}-${name}@example.com`;

async function createEvent(name: string, date: Date) {
  const id = `${prefix}-${name}`;
  await db.event.create({
    data: {
      id,
      name: id,
      date,
      url: "",
      submissions: {
        create: {
          name: "Project",
          tagline: "Tagline",
          description: "Description",
          email: email(`${name}-submission`),
          url: "https://example.com",
          pocName: "Presenter",
        },
      },
      demos: {
        create: { index: 0, name: "Demo", email: email(`${name}-demo`) },
      },
      attendees: {
        create: {
          id: `${id}-attendee`,
          name: "Attendee",
          email: email(`${name}-attendee`),
        },
      },
    },
  });
  return id;
}

async function emailsOf(eventId: string) {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      submissions: { select: { email: true } },
      demos: { select: { email: true } },
      attendees: {
        where: { id: `${eventId}-attendee` },
        select: { email: true, name: true },
      },
    },
  });
  return {
    submission: event.submissions[0]!.email,
    demo: event.demos[0]!.email,
    attendee: event.attendees[0]!.email,
    attendeeName: event.attendees[0]!.name,
  };
}

describe("scrubExpiredEmails", () => {
  after(async () => {
    await db.attendee.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.event.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.admin.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.$disconnect();
  });

  it("clears emails exactly 30 days after the event date, and keeps admins and users", async () => {
    // Exactly 30 days old: scrubbed. One minute younger: kept.
    const expired = await createEvent(
      "expired",
      new Date(now.getTime() - 30 * DAY_MS),
    );
    const kept = await createEvent(
      "kept",
      new Date(now.getTime() - 30 * DAY_MS + 60_000),
    );
    // An attendee shared with a younger event keeps their email.
    await db.attendee.create({
      data: {
        id: `${prefix}-shared`,
        email: email("shared"),
        events: { connect: [{ id: expired }, { id: kept }] },
      },
    });
    await db.admin.create({ data: { email: email("admin") } });
    await db.user.create({ data: { email: email("user") } });

    const first = await scrubExpiredEmails(db, now);
    assert.ok(
      first.submissions >= 1 && first.demos >= 1 && first.attendees >= 1,
    );

    assert.deepEqual(await emailsOf(expired), {
      submission: null,
      demo: null,
      attendee: null,
      attendeeName: "Attendee",
    });
    assert.deepEqual(await emailsOf(kept), {
      submission: email("kept-submission"),
      demo: email("kept-demo"),
      attendee: email("kept-attendee"),
      attendeeName: "Attendee",
    });
    const shared = await db.attendee.findUniqueOrThrow({
      where: { id: `${prefix}-shared` },
    });
    assert.equal(shared.email, email("shared"));
    assert.ok(await db.admin.findUnique({ where: { email: email("admin") } }));
    assert.ok(await db.user.findUnique({ where: { email: email("user") } }));

    // Idempotent: nothing left to clear at the same moment.
    assert.deepEqual(await scrubExpiredEmails(db, now), {
      submissions: 0,
      demos: 0,
      attendees: 0,
    });
  });
});
