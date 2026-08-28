type RankedDemo = {
  id: string;
  index: number;
  votable: boolean;
};

type RankedVote = {
  demoId: string | null;
  amount: number | null;
};

export function rankAutomaticAwardWinners(
  demos: RankedDemo[],
  votes: RankedVote[],
  isPitchNight: boolean,
): string[] {
  const scores = new Map(
    demos.filter((demo) => demo.votable).map((demo) => [demo.id, 0]),
  );

  for (const vote of votes) {
    if (!vote.demoId || !scores.has(vote.demoId)) continue;
    const value = isPitchNight ? vote.amount ?? 0 : 1;
    scores.set(vote.demoId, scores.get(vote.demoId)! + value);
  }

  return demos
    .filter((demo) => scores.has(demo.id))
    .sort(
      (a, b) =>
        scores.get(b.id)! - scores.get(a.id)! ||
        a.index - b.index ||
        a.id.localeCompare(b.id),
    )
    .map((demo) => demo.id);
}
