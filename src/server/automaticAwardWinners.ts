import { type Prisma } from "@prisma/client";

import { rankAutomaticAwardWinners } from "~/lib/automaticAwardWinners";
import { type EventConfig } from "~/lib/types/eventConfig";
import { countedVotesWhere } from "~/server/voterEligibility";

// Call while holding the event's voting lock, so moderation and voting cannot
// change the ranking halfway through assigning the awards.
export async function assignAutomaticAwardWinners(
  prisma: Prisma.TransactionClient,
  eventId: string,
) {
  const rankingAward = await prisma.award.findFirst({
    where: { eventId, winnerRank: 1 },
    select: {
      event: {
        select: {
          config: true,
          demos: { select: { id: true, index: true, votable: true } },
        },
      },
      votes: {
        where: countedVotesWhere(eventId),
        select: { demoId: true, amount: true },
      },
    },
  });

  if (!rankingAward) return;

  const config = rankingAward.event.config as EventConfig;
  const rankedDemoIds = rankAutomaticAwardWinners(
    rankingAward.event.demos,
    rankingAward.votes,
    config.isPitchNight ?? false,
  );
  const automaticAwards = await prisma.award.findMany({
    where: { eventId, winnerRank: { not: null } },
    select: { id: true, winnerRank: true },
  });

  for (const award of automaticAwards) {
    const winnerId = rankedDemoIds[(award.winnerRank ?? 0) - 1] ?? null;
    await prisma.award.update({
      where: { id: award.id },
      data: { winnerId, winnerName: null },
    });
  }
}
