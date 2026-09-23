import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { EventPhase } from "~/lib/types/currentEvent";
import { attendeeNameSchema, duplicateVoterIds } from "~/lib/voters";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { assignAutomaticAwardWinners } from "~/server/automaticAwardWinners";
import { db } from "~/server/db";
import { countedVotesWhere, voterEligibility } from "~/server/voterEligibility";
import { lockVotingEvent } from "~/server/votingLock";

export const attendeeRouter = createTRPCRouter({
  upsert: publicProcedure
    .input(z.object({ id: z.string(), eventId: z.string() }))
    .query(async ({ input }) => {
      return db.attendee.upsert({
        where: { id: input.id },
        create: {
          id: input.id,
          events: { connect: { id: input.eventId } },
        },
        update: {
          events: { connect: { id: input.eventId } },
        },
      });
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: attendeeNameSchema,
        email: z.string().nullable(),
        linkedin: z.string().nullable(),
        type: z.string().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      return db.attendee.update({
        where: { id: input.id },
        data: { ...input },
      });
    }),
  votingStatus: publicProcedure
    .input(z.object({ eventId: z.string(), attendeeId: z.string() }))
    .query(({ input }) =>
      voterEligibility(db, input.eventId, input.attendeeId),
    ),
  getVoters: protectedProcedure
    .input(z.string())
    .query(async ({ input: eventId }) => {
      const attendees = await db.attendee.findMany({
        where: { events: { some: { id: eventId } } },
        select: {
          id: true,
          name: true,
          excludedFromEvents: { where: { id: eventId }, select: { id: true } },
          votes: {
            where: { eventId, demoId: { not: null } },
            select: { amount: true },
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      const duplicates = duplicateVoterIds(attendees);
      return attendees.map((attendee) => ({
        id: attendee.id,
        name: attendee.name?.trim() ? attendee.name.trim() : null,
        excluded: attendee.excludedFromEvents.length > 0,
        duplicateName: duplicates.has(attendee.id),
        totalInvested: attendee.votes.reduce(
          (sum, vote) => sum + (vote.amount ?? 0),
          0,
        ),
        voteCount: attendee.votes.filter(
          (vote) => vote.amount === null || vote.amount > 0,
        ).length,
      }));
    }),
  setVoterExcluded: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        attendeeId: z.string(),
        excluded: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      return db.$transaction(async (prisma) => {
        await lockVotingEvent(prisma, input.eventId);
        const attendee = await prisma.attendee.findFirst({
          where: {
            id: input.attendeeId,
            events: { some: { id: input.eventId } },
          },
          select: { id: true },
        });
        if (!attendee) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Attendee not found in this event",
          });
        }
        const event = await prisma.event.update({
          where: { id: input.eventId },
          data: {
            excludedVoters: input.excluded
              ? { connect: { id: attendee.id } }
              : { disconnect: { id: attendee.id } },
          },
          select: { livePhase: true },
        });
        if (event.livePhase !== null && event.livePhase >= EventPhase.Results) {
          await assignAutomaticAwardWinners(prisma, input.eventId);
        }
        return { excluded: input.excluded };
      });
    }),
  delete: protectedProcedure.input(z.string()).mutation(async ({ input }) => {
    return db.attendee.delete({ where: { id: input } });
  }),
  getAnalytics: protectedProcedure
    .input(z.string())
    .query(async ({ input: eventId }) => {
      const attendees = await db.attendee.findMany({
        where: { events: { some: { id: eventId } } },
        include: {
          _count: {
            select: {
              feedback: { where: { eventId } },
              votes: { where: countedVotesWhere(eventId) },
            },
          },
          eventFeedback: {
            where: { eventId },
            select: { surveyOpened: true, comment: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return attendees;
    }),
});
