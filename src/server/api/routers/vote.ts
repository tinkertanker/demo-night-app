import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { stickerAwardId } from "~/lib/types/award";
import { votingSettings } from "~/lib/types/eventConfig";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { EventPhase, getLiveEvent } from "~/server/liveEvent";
import {
  assertVoterCanVote,
  countedVotesWhere,
} from "~/server/voterEligibility";
import { lockVotingEvent } from "~/server/votingLock";

export const voteRouter = createTRPCRouter({
  all: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        attendeeId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const votes = await db.vote.findMany({
        where: { eventId: input.eventId, attendeeId: input.attendeeId },
      });
      // Group votes by awardId - for demo nights returns single vote, for pitch nights returns array
      return votes;
    }),
  upsert: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        attendeeId: z.string(),
        awardId: z.string(),
        demoId: z.string().nullable(),
        amount: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await db.$transaction(async (prisma) => {
          await lockVotingEvent(prisma, input.eventId);
          await assertVotingIsOpen(prisma, input.eventId);
          await assertVoteBelongsToEvent(prisma, input);
          await assertVoterCanVote(prisma, input.eventId, input.attendeeId);

          const event = await prisma.event.findUniqueOrThrow({
            where: { id: input.eventId },
            select: { config: true },
          });
          const settings = votingSettings(event.config);
          if (settings.weighted && input.demoId && input.amount == null) {
            throw new Error("An allocation amount is required");
          }
          if (!settings.weighted && input.amount != null) {
            throw new Error("This event uses award votes, not allocations");
          }
          if (
            settings.mode === "stickers" &&
            input.amount != null &&
            input.amount > 1
          ) {
            throw new Error("Give at most one favourite sticker per project");
          }

          // Validate investment amount if provided
          if (input.amount !== null && input.amount !== undefined) {
            if (input.amount % settings.step !== 0) {
              throw new Error(
                `Use increments of ${settings.format(settings.step)}`,
              );
            }
            if (input.amount < 0) {
              throw new Error("Investment amount cannot be negative");
            }

            // Check total allocated doesn't exceed $100k for this award
            const allocated = await prisma.vote.aggregate({
              where: {
                eventId: input.eventId,
                attendeeId: input.attendeeId,
                ...(settings.mode === "stickers"
                  ? {}
                  : { awardId: input.awardId }),
                NOT: {
                  demoId: input.demoId, // Exclude current demo to avoid double-counting on update
                },
              },
              _sum: { amount: true },
            });

            const totalAllocated = allocated._sum.amount ?? 0;

            if (totalAllocated + input.amount > settings.budget) {
              const remaining = settings.budget - totalAllocated;
              throw new Error(
                `Your allowance is ${settings.format(settings.budget)}. Remaining: ${settings.format(remaining)}.`,
              );
            }
          }

          if (input.demoId && input.amount === 0) {
            await prisma.vote.deleteMany({
              where: {
                eventId: input.eventId,
                attendeeId: input.attendeeId,
                awardId: input.awardId,
                demoId: input.demoId,
              },
            });
            return null;
          }

          // Use the new compound unique key that includes demoId
          // If demoId is null, we need to delete any existing vote for this award (demo night clearing vote)
          if (input.demoId === null) {
            // For demo nights: delete existing vote for this award if clearing selection
            await prisma.vote.deleteMany({
              where: {
                eventId: input.eventId,
                attendeeId: input.attendeeId,
                awardId: input.awardId,
              },
            });
            return null as any; // Return null when clearing vote
          }

          if (!settings.weighted) {
            // Every one-choice ballot replaces this person's previous pick.
            await prisma.vote.deleteMany({
              where: {
                eventId: input.eventId,
                attendeeId: input.attendeeId,
                awardId: input.awardId,
                demoId: { not: input.demoId },
              },
            });
          }
          // For valid votes (demoId is not null), upsert the vote
          return prisma.vote.upsert({
            where: {
              eventId_attendeeId_awardId_demoId: {
                eventId: input.eventId,
                attendeeId: input.attendeeId,
                awardId: input.awardId,
                demoId: input.demoId,
              },
            },
            create: { ...input },
            update: { ...input },
          });
        });
      } catch (error: any) {
        if (error.code === "P2002") {
          throw new Error("Cannot vote for the same award twice");
        }
        throw error;
      }
    }),
  getTotalInvestments: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        awardId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const event = await db.event.findUniqueOrThrow({
        where: { id: input.eventId },
        select: { config: true },
      });
      if (!votingSettings(event.config).showResults) return {};
      const votes = await db.vote.findMany({
        where: {
          ...countedVotesWhere(input.eventId),
          awardId: input.awardId,
        },
        select: {
          demoId: true,
          amount: true,
        },
      });

      const investmentsByDemo = votes.reduce(
        (acc, vote) => {
          if (vote.demoId && vote.amount) {
            acc[vote.demoId] = (acc[vote.demoId] ?? 0) + vote.amount;
          }
          return acc;
        },
        {} as Record<string, number>,
      );

      return investmentsByDemo;
    }),
  delete: publicProcedure.input(z.string()).mutation(async ({ input }) => {
    return db.$transaction(async (prisma) => {
      const vote = await prisma.vote.findUniqueOrThrow({
        where: { id: input },
        select: { eventId: true, attendeeId: true },
      });
      await lockVotingEvent(prisma, vote.eventId);
      await assertVotingIsOpen(prisma, vote.eventId);
      await assertVoterCanVote(prisma, vote.eventId, vote.attendeeId);
      return prisma.vote.delete({
        where: { id: input },
      });
    });
  }),
});

async function assertVotingIsOpen(
  prisma: Parameters<typeof lockVotingEvent>[0],
  eventId: string,
) {
  const [event, liveEvent] = await Promise.all([
    prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { livePhase: true },
    }),
    getLiveEvent(eventId, prisma),
  ]);
  let livePhase = event.livePhase;

  if (livePhase === null && liveEvent) {
    livePhase = liveEvent.phase;
    await prisma.event.update({
      where: { id: eventId },
      data: { livePhase },
    });
  }

  // livePhase is kept when an event is stopped (so restarting resumes it), so
  // also require the event to still be live.
  if (!liveEvent || livePhase !== EventPhase.Voting) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Voting is closed",
    });
  }
}

async function assertVoteBelongsToEvent(
  prisma: Parameters<typeof lockVotingEvent>[0],
  input: {
    eventId: string;
    attendeeId: string;
    awardId: string;
    demoId: string | null;
    amount?: number | null;
  },
) {
  const [awards, demo, attendee] = await Promise.all([
    prisma.award.findMany({
      where: { eventId: input.eventId },
      orderBy: [{ index: "asc" }, { id: "asc" }],
      select: { id: true, votable: true, winnerRank: true },
    }),
    input.demoId
      ? prisma.demo.findFirst({
          where: {
            id: input.demoId,
            eventId: input.eventId,
            ...(input.amount === 0 ? {} : { votable: true }),
          },
          select: { id: true },
        })
      : Promise.resolve({ id: "cleared-vote" }),
    prisma.attendee.findFirst({
      where: { id: input.attendeeId, events: { some: { id: input.eventId } } },
      select: { id: true },
    }),
  ]);

  const award = awards.find((award) => award.id === input.awardId);
  if (!award || !demo || !attendee) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Vote does not belong to this event",
    });
  }
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: input.eventId },
    select: { config: true },
  });
  if (
    !award.votable ||
    (votingSettings(event.config).mode === "stickers" &&
      award.id !== stickerAwardId(awards))
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This award is not open for voting",
    });
  }
}
