import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { EventPhase, getLiveEvent } from "~/lib/types/currentEvent";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
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
        amount: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await db.$transaction(async (prisma) => {
          await lockVotingEvent(prisma, input.eventId);
          await assertVotingIsOpen(prisma, input.eventId);
          await assertVoteBelongsToEvent(prisma, input);

          // Validate investment amount if provided
          if (input.amount !== null && input.amount !== undefined) {
            if (input.amount % 1000 !== 0) {
              throw new Error("Investment amount must be in $1k increments");
            }
            if (input.amount < 0) {
              throw new Error("Investment amount cannot be negative");
            }

            // Check total allocated doesn't exceed $100k for this award
            const allocated = await prisma.vote.aggregate({
              where: {
                eventId: input.eventId,
                attendeeId: input.attendeeId,
                awardId: input.awardId,
                NOT: {
                  demoId: input.demoId, // Exclude current demo to avoid double-counting on update
                },
              },
              _sum: { amount: true },
            });

            const totalAllocated = allocated._sum.amount ?? 0;

            if (totalAllocated + input.amount > 100000) {
              const remaining = 100000 - totalAllocated;
              throw new Error(
                `Total investment cannot exceed $100,000. You have $${remaining / 1000}k remaining.`,
              );
            }
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
      const votes = await db.vote.findMany({
        where: {
          eventId: input.eventId,
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
        select: { eventId: true },
      });
      await lockVotingEvent(prisma, vote.eventId);
      await assertVotingIsOpen(prisma, vote.eventId);
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
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { livePhase: true },
  });
  let livePhase = event.livePhase;

  if (livePhase === null) {
    const liveEvent = await getLiveEvent(eventId);
    if (liveEvent) {
      livePhase = liveEvent.phase;
      await prisma.event.update({
        where: { id: eventId },
        data: { livePhase },
      });
    }
  }

  if (livePhase !== EventPhase.Voting) {
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
  },
) {
  const [award, demo, attendee] = await Promise.all([
    prisma.award.findFirst({
      where: { id: input.awardId, eventId: input.eventId },
      select: { id: true },
    }),
    input.demoId
      ? prisma.demo.findFirst({
          where: { id: input.demoId, eventId: input.eventId },
          select: { id: true },
        })
      : Promise.resolve({ id: "cleared-vote" }),
    prisma.attendee.findFirst({
      where: { id: input.attendeeId, events: { some: { id: input.eventId } } },
      select: { id: true },
    }),
  ]);

  if (!award || !demo || !attendee) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Vote does not belong to this event",
    });
  }
}
