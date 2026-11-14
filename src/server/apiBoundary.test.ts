import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client } from "pg";
import SuperJSON from "superjson";

import { AUTH_SESSION_COOKIE } from "~/lib/auth-cookies";
import { endOfSingaporeDay } from "~/lib/singaporeDate";
import { type AppRouter } from "~/server/api/root";
import { db } from "~/server/db";

// Exercise the HTTP/session boundary against disposable local fixtures only.
assert.ok(
  ["localhost", "127.0.0.1", "::1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
  "API boundary tests require a local database",
);
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname));
const prefix = `boundary-test-${crypto.randomUUID()}`;
const ownerEmail = `${prefix}-revokedxadmin@example.com`;
const removedEmail = `${prefix}-revoked_admin@example.com`;
const ownerToken = crypto.randomUUID();
const removedToken = crypto.randomUUID();
const futureEventId = `${prefix}-future`;
const pastEventId = `${prefix}-past`;
const secret = crypto.randomUUID();

function client(token?: string, secure = false) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        transformer: SuperJSON,
        headers: token
          ? {
              cookie: `${secure ? "__Secure-" : ""}${AUTH_SESSION_COOKIE}=${token}`,
            }
          : {},
      }),
    ],
  });
}
const publicClient = client();
const owner = client(ownerToken);
const submission = {
  id: crypto.randomUUID(),
  name: "A project",
  tagline: "A tagline",
  description: "Description",
  url: "https://example.com",
  pocName: "Presenter",
};

before(async () => {
  assert.equal(
    await db.admin.count(),
    0,
    "API boundary tests require an unseeded disposable local database to test the last-admin invariant",
  );
  for (const [email, sessionToken] of [
    [ownerEmail, ownerToken],
    [removedEmail, removedToken],
  ] as const) {
    await db.user.create({
      data: {
        email,
        sessions: {
          create: { sessionToken, expires: new Date(Date.now() + 3_600_000) },
        },
      },
    });
    await db.admin.create({ data: { email } });
  }
  for (const [id, offset] of [
    [pastEventId, -3],
    [futureEventId, 3],
  ] as const) {
    await db.event.create({
      data: {
        id,
        name: "Boundary test",
        date: new Date(Date.now() + offset * 86_400_000),
        url: "",
        secret: id === futureEventId ? secret : crypto.randomUUID(),
      },
    });
  }
});

after(async () => {
  await db.event.deleteMany({
    where: { id: { in: [pastEventId, futureEventId] } },
  });
  await db.attendee.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.user.deleteMany({
    where: { email: { in: [ownerEmail, removedEmail] } },
  });
  await db.admin.deleteMany({
    where: { email: { in: [ownerEmail, removedEmail] } },
  });
  await db.$disconnect();
});

describe("submission API boundaries", () => {
  it("rejects closed intake without writing, while accepting a future event", async () => {
    await assert.rejects(
      publicClient.submission.create.mutate({
        ...submission,
        eventId: `${prefix}-missing`,
      }),
      { message: "Event not found" },
    );
    await assert.rejects(
      publicClient.submission.create.mutate({
        ...submission,
        eventId: pastEventId,
      }),
      /submissions closed/i,
    );
    assert.equal(
      await db.submission.count({ where: { eventId: pastEventId } }),
      0,
    );
    // Intake closes at the start of the Singapore day, not at the event's
    // stored time or at UTC midnight.
    await db.event.update({
      where: { id: pastEventId },
      data: { date: endOfSingaporeDay(new Date()) },
    });
    await assert.rejects(
      publicClient.submission.create.mutate({
        ...submission,
        eventId: pastEventId,
      }),
      /submissions closed/i,
    );
    assert.equal(
      await db.submission.count({ where: { eventId: pastEventId } }),
      0,
    );
    const saved = await publicClient.submission.create.mutate({
      ...submission,
      eventId: futureEventId,
    });
    assert.equal(saved.eventId, futureEventId);
    await assert.rejects(
      publicClient.submission.create.mutate({
        ...submission,
        eventId: futureEventId,
      }),
      /already been received/i,
    );
    // Same project/person in a separate draft is allowed. No identity dedup.
    const other = await publicClient.submission.create.mutate({
      ...submission,
      id: crypto.randomUUID(),
      eventId: futureEventId,
    });
    assert.notEqual(other.id, saved.id);
    const concurrentId = crypto.randomUUID();
    const concurrent = await Promise.allSettled(
      [0, 1].map(() =>
        publicClient.submission.create.mutate({
          ...submission,
          id: concurrentId,
          eventId: futureEventId,
        }),
      ),
    );
    assert.equal(
      concurrent.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(await db.submission.count({ where: { id: concurrentId } }), 1);
  });

  it("binds review credentials to the target submission, including read-only updates", async () => {
    const target = await db.submission.create({
      data: {
        ...submission,
        id: crypto.randomUUID(),
        eventId: pastEventId,
      },
    });
    for (const fields of [
      {},
      { status: "CONFIRMED" as const, comment: "Changed" },
    ]) {
      await assert.rejects(
        publicClient.submission.update.mutate({
          eventId: futureEventId,
          secret,
          id: target.id,
          ...fields,
        }),
      );
      assert.deepEqual(
        await db.submission.findUnique({ where: { id: target.id } }),
        target,
      );
    }
    const own = await db.submission.create({
      data: {
        ...submission,
        id: crypto.randomUUID(),
        eventId: futureEventId,
      },
    });
    await assert.rejects(
      publicClient.submission.update.mutate({
        eventId: futureEventId,
        secret: "wrong",
        id: own.id,
        flagged: true,
      }),
      /unauthorized/i,
    );
    const updated = await publicClient.submission.update.mutate({
      eventId: futureEventId,
      secret,
      id: own.id,
      flagged: true,
    });
    assert.equal(updated.flagged, true);
  });

  it("discards legacy contacts on submission, conversion, editing and imports, while retaining admin access", async () => {
    const legacy = {
      ...submission,
      id: crypto.randomUUID(),
      eventId: futureEventId,
      email: "legacy@example.com",
    };
    const saved = await publicClient.submission.create.mutate(legacy);
    assert.equal("email" in saved, false);
    const changed = await owner.submission.adminUpdate.mutate({
      ...legacy,
      id: saved.id,
      pocName: "Retained presenter",
    });
    assert.equal(changed.pocName, "Retained presenter");
    assert.equal("email" in changed, false);
    // Existing database values must not leak before the post-deploy purge.
    await db.$executeRaw`UPDATE "Submission" SET email = 'old@example.com' WHERE id = ${saved.id}`;
    const listed = await publicClient.submission.all.query({
      eventId: futureEventId,
      secret,
    });
    assert.equal(
      listed.some((entry) => "email" in entry),
      false,
    );
    const demo = await owner.submission.convertToDemo.mutate(saved.id);
    assert.equal("email" in demo, false);
    await db.$executeRaw`UPDATE "Demo" SET email = 'old@example.com' WHERE id = ${demo.id}`;
    const edit = {
      id: demo.id,
      secret: demo.secret,
      name: "Updated demo",
      url: "https://example.com",
      email: "new@example.com",
    };
    assert.equal(
      "email" in (await publicClient.demo.update.mutate(edit)),
      false,
    );
    assert.equal(
      "email" in
        (await publicClient.demo.get.query({
          id: demo.id,
          secret: demo.secret,
        })),
      false,
    );
    assert.equal(
      "email" in (await owner.event.getAdmin.query(futureEventId))!.demos[0]!,
      false,
    );
    await assert.rejects(
      publicClient.demo.update.mutate({ ...edit, secret: "wrong" }),
    );
    const adminDemo = await owner.demo.upsert.mutate({
      ...edit,
      originalId: demo.id,
      eventId: futureEventId,
      votable: true,
    });
    assert.equal(adminDemo.name, "Updated demo");
    await owner.demo.setDemos.mutate({
      eventId: futureEventId,
      demos: [
        {
          name: "Imported demo",
          description: "Kept",
          url: "https://example.com",
          votable: true,
          ...{ email: "csv@example.com" },
        },
      ],
    });
    await owner.submission.setSubmissions.mutate({
      eventId: futureEventId,
      submissions: [
        {
          ...submission,
          id: crypto.randomUUID(),
          demoUrl: null,
          ...{ email: "csv@example.com" },
        },
      ],
    });
    const contacts = await db.$queryRaw<
      { demos: bigint; submissions: bigint }[]
    >`
      SELECT (SELECT count(*) FROM "Demo" WHERE "eventId" = ${futureEventId} AND email IS NOT NULL) AS demos,
             (SELECT count(*) FROM "Submission" WHERE "eventId" = ${futureEventId} AND email IS NOT NULL) AS submissions`;
    assert.deepEqual(contacts[0], { demos: 0n, submissions: 0n });
    const attendeeId = `${prefix}-attendee`;
    await publicClient.attendee.upsert.query({
      id: attendeeId,
      eventId: futureEventId,
    });
    await db.$executeRaw`UPDATE "Attendee" SET email = 'legacy@example.com' WHERE id = ${attendeeId}`;
    const attendee = await publicClient.attendee.update.mutate({
      id: attendeeId,
      name: "Retained attendee",
      ...{ email: "ignored@example.com" },
    });
    assert.equal(attendee.name, "Retained attendee");
    assert.equal("email" in attendee, false);
    assert.equal(
      (await owner.attendee.getAnalytics.query(futureEventId)).some(
        (entry) => "email" in entry,
      ),
      false,
    );
    const partner = {
      name: "Partner",
      url: "https://example.com",
      description: "Kept partner",
      email: "partner@example.com",
    };
    await db.event.update({
      where: { id: futureEventId },
      data: { config: { partners: [partner] } },
    });
    for (const event of [
      await publicClient.event.get.query(futureEventId),
      await owner.event.getAdmin.query(futureEventId),
    ]) {
      assert.ok(!JSON.stringify(event).includes(partner.email));
    }
    assert.ok(
      !JSON.stringify(await owner.event.allAdmin.query()).includes(
        partner.email,
      ),
    );
    const editedEvent = await owner.event.upsert.mutate({
      originalId: futureEventId,
      name: "Retained event",
    });
    assert.ok(!JSON.stringify(editedEvent).includes(partner.email));
    const reimported = await owner.event.upsert.mutate({
      originalId: futureEventId,
      config: { partners: [partner], isPitchNight: false },
    });
    assert.ok(!JSON.stringify(reimported).includes(partner.email));
    assert.ok(
      (await owner.admin.all.query()).some(
        (admin) => admin.email === ownerEmail,
      ),
    );
    await db.event.update({
      where: { id: pastEventId },
      data: { config: { partners: [partner] } },
    });
    await assert.rejects(
      publicClient.event.delete.mutate(pastEventId),
      /UNAUTHORIZED/,
    );
    const deleted = await owner.event.delete.mutate(pastEventId);
    assert.deepEqual(deleted, { id: pastEventId });
    assert.equal(
      await db.event.findUnique({ where: { id: pastEventId } }),
      null,
    );
  });
});

describe("administrator revocation", () => {
  it("denies a still-valid session after allowlist removal through either cookie path", async () => {
    const sessions = [client(removedToken), client(removedToken, true)];
    for (const session of sessions)
      assert.ok((await session.admin.all.query()).length >= 2);
    const page = `${baseUrl}/admin/${futureEventId}/submissions`;
    const pageOptions = {
      redirect: "manual" as const,
      headers: {
        RSC: "1",
        cookie: `${AUTH_SESSION_COOKIE}=${removedToken}; __Secure-${AUTH_SESSION_COOKIE}=${removedToken}`,
      },
    };
    const allowed = await fetch(page, pageOptions);
    assert.equal(allowed.status, 200);
    const adminPayload = await allowed.text();
    assert.ok(adminPayload.includes(secret));
    assert.match(adminPayload, /"isAdmin":true/);
    await db.admin.delete({ where: { email: removedEmail } });
    try {
      const denied = await fetch(page, {
        redirect: "manual",
        headers: { cookie: pageOptions.headers.cookie },
      });
      assert.equal(denied.status, 307);
      assert.ok(
        denied.headers.get("location")?.endsWith("/404?type=invalid-secret"),
      );
      assert.ok(!(await denied.text()).includes(secret));
      // The intentionally shareable review link still grants guest access.
      const guest = await fetch(`${page}?secret=${secret}`, pageOptions);
      assert.equal(guest.status, 200);
      const guestPayload = await guest.text();
      assert.ok(guestPayload.includes(secret));
      assert.match(guestPayload, /"isAdmin":false/);
      for (const session of sessions) {
        await assert.rejects(session.admin.all.query(), /FORBIDDEN/);
        await assert.rejects(
          session.admin.add.mutate({ email: removedEmail }),
          /FORBIDDEN/,
        );
      }
      assert.equal(
        await db.admin.findUnique({ where: { email: removedEmail } }),
        null,
      );
      assert.ok((await owner.admin.all.query()).length >= 1);
    } finally {
      await db.admin.upsert({
        where: { email: removedEmail },
        create: { email: removedEmail },
        update: {},
      });
    }
  });

  it("removes the revoked user's sessions without removing the remaining admin's session", async () => {
    const removed = await db.admin.findUniqueOrThrow({
      where: { email: removedEmail },
    });
    const user = await db.user.findUniqueOrThrow({
      where: { email: removedEmail },
    });
    await db.session.create({
      data: {
        userId: user.id,
        sessionToken: crypto.randomUUID(),
        expires: new Date(Date.now() + 3_600_000),
      },
    });
    await owner.admin.remove.mutate({ id: removed.id });
    assert.equal(await db.session.count({ where: { userId: user.id } }), 0);
    assert.ok(
      await db.session.findUnique({ where: { sessionToken: ownerToken } }),
    );
    await assert.rejects(
      client(removedToken).admin.add.mutate({ email: removedEmail }),
      /UNAUTHORIZED/,
    );
  });

  it("keeps one usable administrator when the last two remove themselves concurrently", async () => {
    for (const [email, token] of [
      [ownerEmail, ownerToken],
      [removedEmail, removedToken],
    ] as const) {
      await db.admin.upsert({
        where: { email },
        create: { email },
        update: {},
      });
      const user = await db.user.findUniqueOrThrow({
        where: { email },
      });
      await db.session.upsert({
        where: { sessionToken: token },
        create: {
          userId: user.id,
          sessionToken: token,
          expires: new Date(Date.now() + 3_600_000),
        },
        update: {},
      });
    }
    const admins = await db.admin.findMany();
    assert.equal(admins.length, 2);
    // Hold the rows until both HTTP requests reach a database lock. Without
    // serialization both requests can count two admins before either deletes.
    const blocker = new Client({ connectionString: process.env.DATABASE_URL });
    await blocker.connect();
    await blocker.query("BEGIN");
    await blocker.query('SELECT id FROM "Admin" FOR UPDATE');
    const removals = Promise.allSettled(
      admins.map((admin) =>
        client(
          admin.email === ownerEmail ? ownerToken : removedToken,
        ).admin.remove.mutate({ id: admin.id }),
      ),
    );
    try {
      let waiting = 0;
      for (let attempt = 0; attempt < 100 && waiting < 2; attempt++) {
        const result = await db.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
        `;
        waiting = Number(result[0]!.count);
        if (waiting < 2)
          await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(
        waiting,
        2,
        "Both removals must be in flight before releasing the rows",
      );
    } finally {
      await blocker.query("COMMIT");
      await blocker.end();
      await removals;
    }
    const results = await removals;
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const remaining = await db.admin.findMany();
    assert.equal(remaining.length, 1);
    const survivor = client(
      remaining[0]!.email === ownerEmail ? ownerToken : removedToken,
    );
    assert.equal((await survivor.admin.all.query()).length, 1);
  });
});
