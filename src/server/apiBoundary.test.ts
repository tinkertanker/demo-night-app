import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
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
const ownerEmail = `${prefix}-owner@example.com`;
const removedEmail = `${prefix}-removed@example.com`;
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
    await db.admin.delete({ where: { email: removedEmail } });
    try {
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
});
