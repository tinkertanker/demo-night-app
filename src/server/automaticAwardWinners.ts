import { type Prisma } from "@prisma/client";

import { rankAutomaticAwardWinners } from "~/lib/automaticAwardWinners";
import { votingSettings } from "~/lib/types/eventConfig";
import { countedVotesWhere } from "~/server/voterEligibility";

// Call while holding the event's voting lock, so moderation and voting cannot
// change the ranking halfway through assigning the awards.
export async function assignAutomaticAwardWinners(
  prisma: Prisma.TransactionClient,
  eventId: string,
) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { config: true },
  });
  const settings = votingSettings(event.config);
  if (!settings.showResults) return;
  if (settings.categories) {
    const demos = await prisma.demo.findMany({
      where: { eventId },
      select: { id: true, index: true, votable: true },
    });
    const awards = await prisma.award.findMany({
      where: { eventId, votable: true },
      select: {
        id: true,
        votes: {
          where: countedVotesWhere(eventId),
          select: { demoId: true, amount: true },
        },
      },
    });
    for (const award of awards) {
      const votedDemos = demos.filter((demo) =>
        award.votes.some(
          (vote) =>
            vote.demoId === demo.id &&
            (!settings.weighted || (vote.amount ?? 0) > 0),
        ),
      );
      const winnerId =
        rankAutomaticAwardWinners(
          votedDemos,
          award.votes,
          settings.weighted,
        )[0] ?? null;
      await prisma.award.update({
        where: { id: award.id },
        data: { winnerId, winnerName: null },
      });
    }
    return;
  }
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

  const rankedDemoIds = rankAutomaticAwardWinners(
    rankingAward.event.demos,
    rankingAward.votes,
    settings.weighted,
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
