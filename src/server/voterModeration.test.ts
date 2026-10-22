import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import SuperJSON from "superjson";

import { AUTH_SESSION_COOKIE } from "~/lib/auth-cookies";
import { postcardProgress } from "~/lib/postcards";
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

describe("voting modes and shared postcards", () => {
  it("retains legacy allocations, enforces budget, and clears only one project", async () => {
    await nameAndInvest();
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId,
      demoId: secondDemoId,
      amount: 40000,
    });
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId,
        amount: 61000,
      }),
      /allowance/i,
    );
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId,
        amount: 1500,
      }),
      /increments/i,
    );
    await db.demo.update({ where: { id: demoId }, data: { votable: false } });
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId,
        amount: 5000,
      }),
      /does not belong/i,
    );
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId,
      demoId,
      amount: 0,
    });
    const votes = await caller.vote.all.query({ eventId, attendeeId });
    assert.deepEqual(
      votes.map((vote) => [vote.demoId, vote.amount]),
      [[secondDemoId, 40000]],
    );
  });

  it("uses the same sticker award in the public ballot and validator when award indexes tie", async () => {
    const fallbackId = `${prefix}-aaa-award`;
    await db.award.update({
      where: { id: awardId },
      data: { winnerRank: null },
    });
    await db.award.create({
      data: {
        id: fallbackId,
        eventId,
        name: "Another award",
        index: 0,
        description: "",
      },
    });
    await admin.event.upsert.mutate({
      originalId: eventId,
      config: { isPitchNight: false, votingMode: "stickers" },
    });
    const event = (await caller.event.get.query(eventId))!;
    assert.equal(event.awards[0]!.id, fallbackId);
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId: event.awards[0]!.id,
      demoId,
      amount: 1,
    });
    assert.equal(
      (await caller.vote.all.query({ eventId, attendeeId }))[0]!.awardId,
      fallbackId,
    );
  });

  it("enforces a shared sticker allowance under concurrent requests, without a postcard", async () => {
    await admin.event.upsert.mutate({
      originalId: eventId,
      config: {
        isPitchNight: false,
        votingMode: "stickers",
        stickerAllowance: 1,
      },
    });
    const results = await Promise.allSettled(
      [demoId, secondDemoId].map((id) =>
        caller.vote.upsert.mutate({
          eventId,
          attendeeId,
          awardId,
          demoId: id,
          amount: 1,
        }),
      ),
    );
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const votes = await caller.vote.all.query({ eventId, attendeeId });
    assert.equal(votes.length, 1);
    assert.equal(await db.feedback.count({ where: { eventId } }), 0);
    await caller.attendee.upsert.query({ id: secondAttendeeId, eventId });
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId: secondAttendeeId,
      awardId,
      demoId,
      amount: 1,
    });
    assert.equal(
      (await caller.vote.all.query({ eventId, attendeeId: secondAttendeeId }))
        .length,
      1,
    );
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId: votes[0]!.demoId,
        amount: 2,
      }),
      /at most one/i,
    );
    await assert.rejects(
      caller.vote.upsert.mutate({ eventId, attendeeId, awardId, demoId }),
      /amount is required/i,
    );
    await db.demo.update({
      where: { id: votes[0]!.demoId! },
      data: { votable: false },
    });
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId,
      demoId: votes[0]!.demoId,
      amount: 0,
    });
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId,
      demoId: votes[0]!.demoId === demoId ? secondDemoId : demoId,
      amount: 1,
    });
    await assert.rejects(
      admin.event.upsert.mutate({
        originalId: eventId,
        config: { votingMode: "allocation" },
      }),
      /cannot change/i,
    );
  });

  it("persists optional prompts and free badges after exhaustion, preserving comments and vote totals", async () => {
    await nameAndInvest();
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId,
      demoId,
      amount: 100000,
    });
    await caller.feedback.upsert.mutate({
      eventId,
      attendeeId,
      demoId,
      comment: "Legacy comment",
      claps: 3,
    });
    await caller.feedback.upsert.mutate({
      eventId,
      attendeeId,
      demoId,
      liked: "Clear explanation",
      badges: ["Great explanation", "Made me smile"],
    });
    await caller.feedback.upsert.mutate({
      eventId,
      attendeeId,
      demoId,
      wonder: "Could it work outdoors?",
    });
    await caller.feedback.upsert.mutate({
      eventId,
      attendeeId,
      demoId: secondDemoId,
      badges: ["Creative idea"],
    });
    const cards = await caller.feedback.all.query({ eventId, attendeeId });
    assert.equal(cards[demoId]!.comment, "Legacy comment");
    assert.equal(cards[demoId]!.claps, 3);
    assert.equal(cards[demoId]!.liked, "Clear explanation");
    assert.equal(postcardProgress(Object.values(cards)), 2);
    assert.deepEqual(
      await caller.vote.getTotalInvestments.query({ eventId, awardId }),
      { [demoId]: 100000 },
    );
    const demo = await db.demo.findUniqueOrThrow({ where: { id: demoId } });
    const recap = await caller.demo.get.query({
      id: demoId,
      secret: demo.secret,
    });
    assert.deepEqual(recap.feedback[0]!.badges, [
      "Great explanation",
      "Made me smile",
    ]);
    assert.equal(recap.feedback[0]!.wonder, "Could it work outdoors?");
    await caller.feedback.upsert.mutate({
      eventId,
      attendeeId,
      demoId: secondDemoId,
      badges: [],
    });
    assert.equal(
      postcardProgress(
        Object.values(await caller.feedback.all.query({ eventId, attendeeId })),
      ),
      1,
    );
  });

  it("isolates postcards and sticker votes by event and attendee and closes votes on stop", async () => {
    await admin.event.upsert.mutate({
      originalId: eventId,
      config: { votingMode: "stickers", stickerAllowance: 1 },
    });
    await db.event.create({
      data: {
        id: otherEventId,
        name: "Other",
        date: new Date(),
        url: "",
        demos: {
          create: {
            id: `${prefix}-other-demo`,
            name: "Other project",
            index: 0,
          },
        },
        attendees: { create: { id: secondAttendeeId } },
      },
    });
    await assert.rejects(
      caller.feedback.upsert.mutate({
        eventId,
        attendeeId,
        demoId: `${prefix}-other-demo`,
        liked: "Wrong event",
      }),
      /does not belong/i,
    );
    await assert.rejects(
      caller.feedback.upsert.mutate({
        eventId,
        attendeeId: secondAttendeeId,
        demoId,
        badges: ["Creative idea"],
      }),
      /does not belong/i,
    );
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId: `${prefix}-other-demo`,
        amount: 1,
      }),
      /does not belong/i,
    );
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId,
      demoId,
      amount: 1,
    });
    await caller.feedback.upsert.mutate({
      eventId,
      attendeeId,
      demoId,
      tryNext: "Try a larger font",
    });
    assert.deepEqual(
      await caller.feedback.all.query({
        eventId,
        attendeeId: secondAttendeeId,
      }),
      {},
    );
    assert.deepEqual(
      await caller.feedback.all.query({ eventId: otherEventId, attendeeId }),
      {},
    );
    await admin.event.setLive.mutate({ eventId, live: false });
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId,
        amount: 0,
      }),
      /closed/i,
    );
    await caller.feedback.upsert.mutate({
      eventId,
      attendeeId,
      demoId,
      badges: ["Really useful"],
    });
    assert.equal(
      (await caller.feedback.all.query({ eventId, attendeeId }))[demoId]!
        .tryNext,
      "Try a larger font",
    );
  });

  it("creates Pitching events with money but editing a legacy config does not migrate its units", async () => {
    const created = await admin.event.upsert.mutate({
      id: otherEventId,
      name: "New default",
      date: new Date(),
      url: "",
    });
    assert.equal(
      (created.config as { votingUnit: string }).votingUnit,
      "dollars",
    );
    await nameAndInvest();
    const updated = await admin.event.upsert.mutate({
      originalId: eventId,
      name: "Legacy renamed",
      config: { isPitchNight: true },
    });
    assert.equal(
      (updated.config as { votingUnit?: string }).votingUnit,
      undefined,
    );
    assert.equal(
      (await caller.vote.all.query({ eventId, attendeeId }))[0]!.amount,
      60000,
    );
  });

  it("shares postcards across both brands and modes; badges never change sticker winners", async () => {
    await db.attendee.update({
      where: { id: attendeeId },
      data: { name: "Ada" },
    });
    for (const isPitchNight of [false, true]) {
      for (const votingMode of ["allocation", "stickers"] as const) {
        await db.vote.deleteMany({ where: { eventId } });
        await admin.event.upsert.mutate({
          originalId: eventId,
          config: {
            isPitchNight,
            votingMode,
            votingUnit: "points",
            stickerAllowance: 2,
          },
        });
        await caller.vote.upsert.mutate({
          eventId,
          attendeeId,
          awardId,
          demoId: secondDemoId,
          amount: votingMode === "stickers" ? 1 : 5000,
        });
        await caller.feedback.upsert.mutate({
          eventId,
          attendeeId,
          demoId,
          liked: "Works in either mode",
          badges: [
            "Creative idea",
            "Really useful",
            "Great explanation",
            "Made me smile",
          ],
        });
        await caller.feedback.upsert.mutate({
          eventId,
          attendeeId,
          demoId: secondDemoId,
          comment: "Another project",
        });
        assert.equal(
          postcardProgress(
            Object.values(
              await caller.feedback.all.query({ eventId, attendeeId }),
            ),
          ),
          2,
        );
        await admin.event.updateLiveState.mutate({
          eventId,
          phase: EventPhase.Results,
        });
        assert.equal(
          (await db.award.findUniqueOrThrow({ where: { id: awardId } }))
            .winnerId,
          secondDemoId,
        );
        await admin.event.updateLiveState.mutate({
          eventId,
          phase: EventPhase.Voting,
        });
      }
    }
  });

  it("applies editable templates without replacing awards or demo-session postcards, and freezes templates after voting", async () => {
    await admin.event.updateLiveState.mutate({
      eventId,
      phase: EventPhase.Demos,
    });
    await caller.feedback.upsert.mutate({
      eventId,
      attendeeId,
      demoId,
      comment: "Legacy note",
      liked: "The live demonstration",
      badges: ["Creative idea"],
    });
    const awards = await db.award.findMany({ where: { eventId } });
    const feedback = await caller.feedback.all.query({ eventId, attendeeId });
    for (const template of [
      "categories",
      "noLeaderboard",
      "pitching",
    ] as const) {
      await admin.event.upsert.mutate({
        originalId: eventId,
        config: { template },
      });
      assert.deepEqual(await db.award.findMany({ where: { eventId } }), awards);
      assert.deepEqual(
        await caller.feedback.all.query({ eventId, attendeeId }),
        feedback,
      );
    }
    await admin.event.updateLiveState.mutate({
      eventId,
      phase: EventPhase.Voting,
    });
    await nameAndInvest();
    await assert.rejects(
      admin.event.upsert.mutate({
        originalId: eventId,
        config: { template: "noLeaderboard", votingMode: "allocation" },
      }),
      /cannot change/i,
    );
    assert.equal(
      (await caller.vote.all.query({ eventId, attendeeId }))[0]!.amount,
      60000,
    );
    assert.deepEqual(
      await caller.feedback.all.query({ eventId, attendeeId }),
      feedback,
    );
    await admin.event.upsert.mutate({
      originalId: eventId,
      config: { template: "pitching", votingUnit: "stars", feedbackGoal: 3 },
    });
    assert.equal(
      (await caller.vote.all.query({ eventId, attendeeId }))[0]!.amount,
      60000,
    );
  });

  it("replaces one-choice votes outside Categories, including the legacy fallback", async () => {
    await db.attendee.update({
      where: { id: attendeeId },
      data: { name: "Ada Lovelace" },
    });
    for (const config of [
      { isPitchNight: false },
      { template: "pitching" as const, votingMode: "awards" as const },
      { template: "noLeaderboard" as const, votingMode: "awards" as const },
    ]) {
      await db.vote.deleteMany({ where: { eventId } });
      await admin.event.upsert.mutate({ originalId: eventId, config });
      await caller.vote.upsert.mutate({ eventId, attendeeId, awardId, demoId });
      await caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId: secondDemoId,
      });
      const votes = await caller.vote.all.query({ eventId, attendeeId });
      assert.deepEqual(
        votes.map((vote) => [vote.awardId, vote.demoId]),
        [[awardId, secondDemoId]],
      );
    }
  });

  it("replaces a category choice atomically, permits repeated projects across categories, and tallies each winner independently", async () => {
    const created = await admin.event.upsert.mutate({
      id: otherEventId,
      name: "Categories",
      date: new Date(),
      config: { template: "categories" },
    });
    const newAwards = (await admin.event.getAdmin.query(created.id))!.awards;
    assert.equal(newAwards.length, 3);
    assert.ok(
      newAwards.every((award) => award.votable && award.winnerRank === null),
    );
    await admin.event.upsert.mutate({
      originalId: eventId,
      config: { template: "categories" },
    });
    const category2 = await admin.award.upsert.mutate({
      eventId,
      name: "Useful",
    });
    const emptyCategory = await admin.award.upsert.mutate({
      eventId,
      name: "No votes yet",
    });
    await caller.attendee.upsert.query({ id: secondAttendeeId, eventId });
    const choose = (attendeeId: string, awardId: string, demoId: string) =>
      caller.vote.upsert.mutate({ eventId, attendeeId, awardId, demoId });
    await Promise.all([
      choose(attendeeId, awardId, demoId),
      choose(attendeeId, awardId, secondDemoId),
    ]);
    assert.equal(
      (await caller.vote.all.query({ eventId, attendeeId })).length,
      1,
    );
    await choose(attendeeId, awardId, demoId);
    await choose(attendeeId, category2.id, demoId);
    assert.equal(
      (await caller.vote.all.query({ eventId, attendeeId })).length,
      2,
    );
    await choose(attendeeId, category2.id, secondDemoId);
    await choose(secondAttendeeId, awardId, demoId);
    await choose(secondAttendeeId, category2.id, secondDemoId);
    await admin.event.updateLiveState.mutate({
      eventId,
      phase: EventPhase.Results,
    });
    const result = (await caller.event.get.query(eventId))!;
    assert.equal(
      result.awards.find((award) => award.id === awardId)!.winnerId,
      demoId,
    );
    assert.equal(
      result.awards.find((award) => award.id === category2.id)!.winnerId,
      secondDemoId,
    );
    assert.equal(
      result.awards.find((award) => award.id === emptyCategory.id)!.winnerId,
      null,
    );
    await admin.event.updateLiveState.mutate({
      eventId,
      currentAwardId: category2.id,
    });
    assert.equal(
      (await caller.event.getLiveEvent.query(eventId))!.currentAwardId,
      category2.id,
    );
  });

  it("keeps category allocation budgets independent and recalculates each winner after moderation", async () => {
    await admin.event.upsert.mutate({
      originalId: eventId,
      config: {
        template: "categories",
        votingMode: "allocation",
        votingUnit: "points",
      },
    });
    const category = await admin.award.upsert.mutate({
      eventId,
      name: "Useful",
    });
    for (const [id, amounts] of [
      [awardId, [40000, 10000]],
      [category.id, [5000, 95000]],
    ] as const) {
      for (const [index, amount] of amounts.entries()) {
        await caller.vote.upsert.mutate({
          eventId,
          attendeeId,
          awardId: id,
          demoId: [demoId, secondDemoId][index]!,
          amount,
        });
      }
    }
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId: category.id,
        demoId,
        amount: 6000,
      }),
      /allowance/i,
    );
    await admin.event.updateLiveState.mutate({
      eventId,
      phase: EventPhase.Results,
    });
    assert.equal(
      (await caller.event.get.query(eventId))!.awards.find(
        (a) => a.id === awardId,
      )!.winnerId,
      demoId,
    );
    assert.equal(
      (await caller.event.get.query(eventId))!.awards.find(
        (a) => a.id === category.id,
      )!.winnerId,
      secondDemoId,
    );
    await admin.attendee.setVoterExcluded.mutate({
      eventId,
      attendeeId,
      excluded: true,
    });
    assert.ok(
      (await caller.event.get.query(eventId))!.awards.every(
        (a) => a.winnerId === null,
      ),
    );
    await admin.attendee.setVoterExcluded.mutate({
      eventId,
      attendeeId,
      excluded: false,
    });
    assert.equal(
      (await caller.event.get.query(eventId))!.awards.find(
        (a) => a.id === category.id,
      )!.winnerId,
      secondDemoId,
    );
  });

  it("suppresses No Leaderboard public winners and totals while retaining private records, allowance and feedback", async () => {
    await admin.event.upsert.mutate({
      originalId: eventId,
      config: { template: "noLeaderboard", stickerAllowance: 1 },
    });
    // Retained category awards have no podium rank; stickers still work without replacing them.
    await db.award.update({
      where: { id: awardId },
      data: { winnerRank: null, winnerName: "Private historical winner" },
    });
    await caller.vote.upsert.mutate({
      eventId,
      attendeeId,
      awardId,
      demoId,
      amount: 1,
    });
    await assert.rejects(
      caller.vote.upsert.mutate({
        eventId,
        attendeeId,
        awardId,
        demoId: secondDemoId,
        amount: 1,
      }),
      /allowance/i,
    );
    await caller.feedback.upsert.mutate({
      eventId,
      attendeeId,
      demoId: secondDemoId,
      wonder: "What could we build next?",
      badges: ["Really useful"],
    });
    const cards = await caller.feedback.all.query({ eventId, attendeeId });
    assert.equal(postcardProgress(Object.values(cards)), 1);
    const publicEvent = (await caller.event.get.query(eventId))!;
    assert.equal(publicEvent.awards[0]!.winnerName, null);
    assert.equal(publicEvent.awards[0]!.winnerId, null);
    assert.equal(
      (await caller.event.all.query()).find((event) => event.id === eventId)!
        .awards[0]!.winnerName,
      null,
    );
    assert.deepEqual(
      await caller.vote.getTotalInvestments.query({ eventId, awardId }),
      {},
    );
    const demo = await db.demo.findUniqueOrThrow({ where: { id: demoId } });
    assert.equal(
      (await caller.demo.getStats.query({ id: demoId, secret: demo.secret }))
        .totalMoneyRaised,
      0,
    );
    assert.equal((await admin.award.getVotes.query(awardId)).length, 1);
    assert.equal(
      (await caller.vote.all.query({ eventId, attendeeId }))[0]!.amount,
      1,
    );
    await assert.rejects(
      admin.event.updateLiveState.mutate({ eventId, currentAwardId: awardId }),
      /do not reveal/i,
    );
    await admin.event.updateLiveState.mutate({
      eventId,
      phase: EventPhase.Results,
    });
    assert.equal(
      (await caller.event.getLiveActive.query(eventId))!.phase,
      EventPhase.Recap,
    );
    assert.equal(
      (await admin.event.getAdmin.query(eventId))!.awards[0]!.winnerName,
      "Private historical winner",
    );
    assert.deepEqual(
      await caller.feedback.all.query({ eventId, attendeeId }),
      cards,
    );
  });
});
