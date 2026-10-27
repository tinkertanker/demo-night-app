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
  name: "A project",
  tagline: "A tagline",
  description: "Description",
  email: `${prefix}@example.com`,
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
        email: email === removedEmail ? email.toUpperCase() : email,
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
  await db.user.deleteMany({
    where: { email: { in: [ownerEmail, removedEmail.toUpperCase()] } },
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
      /already exists/i,
    );
  });

  it("binds review credentials to the target submission, including read-only updates", async () => {
    const target = await db.submission.create({
      data: {
        ...submission,
        email: `${prefix}-target@example.com`,
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
        email: `${prefix}-own@example.com`,
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
      where: { email: removedEmail.toUpperCase() },
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
        where: { email: email === removedEmail ? email.toUpperCase() : email },
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
