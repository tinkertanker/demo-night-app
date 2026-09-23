import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import SuperJSON from "superjson";

import { AUTH_SESSION_COOKIE } from "~/lib/auth-cookies";
import { EventPhase } from "~/lib/types/currentEvent";
import { type AppRouter } from "~/server/api/root";
import { db } from "~/server/db";

// These tests create isolated fixtures, never use an existing event, and refuse
// remote databases. Run with the local development environment loaded.
assert.ok(
  ["localhost", "127.0.0.1", "::1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
  "Voter moderation tests require a local database",
);

const prefix = `voter-test-${crypto.randomUUID()}`;
const eventId = `${prefix}-event`;
const attendeeId = `${prefix}-attendee`;
const awardId = `${prefix}-award`;
const demoId = `${prefix}-demo`;
const secondDemoId = `${prefix}-second-demo`;
const secondAttendeeId = `${prefix}-second-attendee`;
const otherEventId = `${prefix}-other-event`;
const sessionToken = crypto.randomUUID();
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname));
const caller = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({ url: `${baseUrl}/api/trpc`, transformer: SuperJSON }),
  ],
});
const admin = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${baseUrl}/api/trpc`,
      transformer: SuperJSON,
      headers: { cookie: `${AUTH_SESSION_COOKIE}=${sessionToken}` },
    }),
  ],
});

before(async () => {
  await db.user.create({
    data: {
      id: `${prefix}-admin`,
      email: `${prefix}@example.com`,
      sessions: {
        create: { sessionToken, expires: new Date(Date.now() + 3_600_000) },
      },
    },
  });
  await db.admin.create({ data: { email: `${prefix}@example.com` } });
});

beforeEach(async () => {
  await db.event.create({
    data: {
      id: eventId,
      name: "Voter moderation test",
      date: new Date(),
      url: "",
      config: { isPitchNight: true },
      livePhase: EventPhase.Voting,
      demos: {
        create: [
          { id: demoId, name: "First pitch", index: 0 },
          { id: secondDemoId, name: "Second pitch", index: 1 },
        ],
      },
      awards: {
        create: {
          id: awardId,
          name: "Funding",
          description: "",
          index: 0,
          winnerRank: 1,
        },
      },
      attendees: { create: { id: attendeeId, name: "   " } },
    },
  });
  // Voting also requires the event to be live.
  await admin.event.setLive.mutate({ eventId, live: true });
});

afterEach(async () => {
  for (const id of [eventId, otherEventId]) {
    await admin.event.setLive.mutate({ eventId: id, live: false });
  }
  await db.event.deleteMany({ where: { id: { in: [eventId, otherEventId] } } });
  await db.attendee.deleteMany({
    where: { id: { in: [attendeeId, secondAttendeeId] } },
  });
});

after(async () => {
  await db.user.deleteMany({ where: { id: `${prefix}-admin` } });
  await db.admin.deleteMany({ where: { email: `${prefix}@example.com` } });
  await db.$disconnect();
});

async function nameAndInvest() {
  const attendee = await caller.attendee.update.mutate({
    id: attendeeId,
    name: "  Ada Lovelace  ",
    email: null,
    linkedin: null,
    type: null,
  });
  assert.equal(attendee.name, "Ada Lovelace");
  return caller.vote.upsert.mutate({
    eventId,
    attendeeId,
    awardId,
    demoId,
    amount: 60_000,
  });
}

describe("investor eligibility", () => {
  it("rejects a blank name at the API, not only in the form", async () => {
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId,
        amount: 25_000,
      }),
      /enter your name/i,
    );
    assert.equal(await db.vote.count({ where: { eventId } }), 0);
  });

  it("flags matching names but permits both people to invest", async () => {
    await nameAndInvest();
    await db.attendee.create({
      data: {
        id: secondAttendeeId,
        name: "ada   LOVELACE",
        events: { connect: { id: eventId } },
      },
    });
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId: secondAttendeeId,
      awardId,
      demoId: secondDemoId,
      amount: 35_000,
    });
    const voters = await admin.attendee.getVoters.query(eventId);
    assert.equal(voters.length, 2);
    assert.ok(voters.every((voter) => voter.duplicateName && !voter.excluded));
    assert.equal(
      voters.find((voter) => voter.id === attendeeId)?.totalInvested,
      60_000,
    );
    assert.equal(
      voters.find((voter) => voter.id === secondAttendeeId)?.totalInvested,
      35_000,
    );
  });

  it("excludes all result consumers, blocks writes and restores the original allocations", async () => {
    const vote = await nameAndInvest();
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId,
      demoId: secondDemoId,
      amount: 15_000,
    });
    const originalVotes = await caller.vote.all.query({ eventId, attendeeId });
    await db.attendee.create({
      data: {
        id: secondAttendeeId,
        name: "Grace Hopper",
        events: { connect: { id: eventId } },
      },
    });
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId: secondAttendeeId,
      awardId,
      demoId: secondDemoId,
      amount: 45_000,
    });
    const demo = await db.demo.findUniqueOrThrow({ where: { id: demoId } });
    const moderate = (excluded: boolean) =>
      admin.attendee.setVoterExcluded.mutate({ eventId, attendeeId, excluded });

    await moderate(true);
    await moderate(true); // Retrying an exclusion must not toggle it back.
    await caller.attendee.upsert.query({ id: attendeeId, eventId });
    await caller.attendee.update.mutate({
      id: attendeeId,
      name: "Another name",
      email: null,
      linkedin: null,
      type: null,
    });
    assert.deepEqual(
      await caller.attendee.votingStatus.query({ eventId, attendeeId }),
      { excluded: true, nameRequired: false },
    );
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId,
        amount: 70_000,
      }),
      /excluded/i,
    );
    await assert.rejects(
      caller.vote.upsert.mutate({ eventId, attendeeId, awardId, demoId: null }),
      /excluded/i,
    );
    await assert.rejects(caller.vote.delete.mutate(vote!.id), /excluded/i);
    assert.deepEqual(
      await caller.vote.all.query({ eventId, attendeeId }),
      originalVotes,
    );
    assert.deepEqual(
      await caller.vote.getTotalInvestments.query({ eventId, awardId }),
      { [secondDemoId]: 45_000 },
    );
    assert.deepEqual(await admin.award.getVotes.query(awardId), [
      { attendeeId: secondAttendeeId, demoId: secondDemoId, amount: 45_000 },
    ]);
    assert.equal(
      (await caller.demo.getStats.query({ id: demoId, secret: demo.secret }))
        .totalMoneyRaised,
      0,
    );
    assert.equal(
      (await admin.attendee.getAnalytics.query(eventId)).find(
        (row) => row.id === attendeeId,
      )?._count.votes,
      0,
    );
    const excludedVoter = (await admin.attendee.getVoters.query(eventId)).find(
      (row) => row.id === attendeeId,
    )!;
    assert.equal(excludedVoter.excluded, true);
    assert.equal(excludedVoter.totalInvested, 75_000);

    await moderate(false);
    await moderate(false);
    assert.deepEqual(
      await caller.vote.getTotalInvestments.query({ eventId, awardId }),
      { [demoId]: 60_000, [secondDemoId]: 60_000 },
    );
    assert.equal(
      (await caller.demo.getStats.query({ id: demoId, secret: demo.secret }))
        .totalMoneyRaised,
      60_000,
    );
    assert.deepEqual(
      await caller.vote.all.query({ eventId, attendeeId }),
      originalVotes,
    );
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId,
      demoId,
      amount: 65_000,
    });
  });

  it("leaves another event's participation and investments untouched", async () => {
    await nameAndInvest();
    await db.event.create({
      data: {
        id: otherEventId,
        name: "Other event",
        date: new Date(),
        url: "",
        livePhase: EventPhase.Voting,
        config: { isPitchNight: true },
        attendees: { connect: { id: attendeeId } },
        demos: {
          create: { id: `${prefix}-other-demo`, name: "Other pitch", index: 0 },
        },
        awards: {
          create: {
            id: `${prefix}-other-award`,
            name: "Other award",
            description: "",
            index: 0,
          },
        },
      },
    });
    await admin.event.setLive.mutate({ eventId: otherEventId, live: true });
    await admin.attendee.setVoterExcluded.mutate({
      eventId,
      attendeeId,
      excluded: true,
    });
    await caller.vote.upsert.mutate({
      eventId: otherEventId,
      attendeeId,
      demoId: `${prefix}-other-demo`,
      awardId: `${prefix}-other-award`,
      amount: 80_000,
    });
    assert.deepEqual(
      await caller.vote.getTotalInvestments.query({
        eventId: otherEventId,
        awardId: `${prefix}-other-award`,
      }),
      { [`${prefix}-other-demo`]: 80_000 },
    );
    assert.equal(
      (await admin.attendee.getVoters.query(otherEventId))[0]?.excluded,
      false,
    );
  });

  it("recalculates automatic winners after exclusion and restore without overwriting manual awards", async () => {
    await nameAndInvest();
    await db.attendee.create({
      data: {
        id: secondAttendeeId,
        name: "Grace Hopper",
        events: { connect: { id: eventId } },
      },
    });
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId: secondAttendeeId,
      awardId,
      demoId: secondDemoId,
      amount: 40_000,
    });
    await db.event.update({
      where: { id: eventId },
      data: { livePhase: EventPhase.Results },
    });
    await db.award.update({
      where: { id: awardId },
      data: { winnerId: demoId },
    });
    const manual = await db.award.create({
      data: {
        eventId,
        name: "Jury",
        description: "",
        index: 1,
        winnerName: "Guest winner",
      },
    });
    await admin.attendee.setVoterExcluded.mutate({
      eventId,
      attendeeId,
      excluded: true,
    });
    assert.equal(
      (await db.award.findUniqueOrThrow({ where: { id: awardId } })).winnerId,
      secondDemoId,
    );
    await admin.attendee.setVoterExcluded.mutate({
      eventId,
      attendeeId,
      excluded: false,
    });
    assert.equal(
      (await db.award.findUniqueOrThrow({ where: { id: awardId } })).winnerId,
      demoId,
    );
    assert.equal(
      (await db.award.findUniqueOrThrow({ where: { id: manual.id } }))
        .winnerName,
      "Guest winner",
    );
  });

  it("keeps an overlapping investment excluded regardless of which request wins the lock", async () => {
    await nameAndInvest();
    const [exclusion, investment] = await Promise.allSettled([
      admin.attendee.setVoterExcluded.mutate({
        eventId,
        attendeeId,
        excluded: true,
      }),
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId,
        amount: 85_000,
      }),
    ]);
    assert.equal(exclusion.status, "fulfilled");
    if (investment.status === "rejected")
      assert.match(String(investment.reason), /excluded/i);
    const saved = await caller.vote.all.query({ eventId, attendeeId });
    assert.equal(
      saved[0]?.amount,
      investment.status === "fulfilled" ? 85_000 : 60_000,
    );
    assert.deepEqual(
      await caller.vote.getTotalInvestments.query({ eventId, awardId }),
      {},
    );
    assert.deepEqual(await admin.award.getVotes.query(awardId), []);
  });

  it("requires admin authentication and event membership for moderation", async () => {
    await assert.rejects(
      caller.attendee.getVoters.query(eventId),
      /UNAUTHORIZED/,
    );
    await assert.rejects(
      caller.attendee.setVoterExcluded.mutate({
        eventId,
        attendeeId,
        excluded: true,
      }),
      /UNAUTHORIZED/,
    );
    await assert.rejects(
      admin.attendee.setVoterExcluded.mutate({
        eventId,
        attendeeId: `${prefix}-unknown`,
        excluded: true,
      }),
      /not found/i,
    );
    await assert.rejects(
      caller.attendee.update.mutate({
        id: attendeeId,
        name: " \t ",
        email: null,
        linkedin: null,
        type: null,
      }),
      /enter your name/i,
    );
  });
});
