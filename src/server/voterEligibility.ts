import { type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { eventConfigSchema } from "~/lib/types/eventConfig";
import { attendeeNameSchema } from "~/lib/voters";

export function countedVotesWhere(eventId: string): Prisma.VoteWhereInput {
  return {
    eventId,
    attendee: { excludedFromEvents: { none: { id: eventId } } },
  };
}

export async function voterEligibility(
  prisma: Prisma.TransactionClient,
  eventId: string,
  attendeeId: string,
) {
  const attendee = await prisma.attendee.findFirst({
    where: { id: attendeeId, events: { some: { id: eventId } } },
    select: {
      name: true,
      events: { where: { id: eventId }, select: { config: true } },
      excludedFromEvents: { where: { id: eventId }, select: { id: true } },
    },
  });
  if (!attendee) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Attendee not found in this event",
    });
  }
  const config = eventConfigSchema.parse(attendee.events[0]?.config);
  return {
    excluded: attendee.excludedFromEvents.length > 0,
    nameRequired:
      config.isPitchNight &&
      !attendeeNameSchema.safeParse(attendee.name).success,
  };
}

export async function assertVoterCanVote(
  prisma: Prisma.TransactionClient,
  eventId: string,
  attendeeId: string,
) {
  const eligibility = await voterEligibility(prisma, eventId, attendeeId);
  if (eligibility.excluded) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Your votes are excluded from this event. Please speak to the organiser.",
    });
  }
  if (eligibility.nameRequired) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Please enter your name before investing",
    });
  }
}
