export type AwardWinnerSource = {
  winnerId: string | null;
  winnerName: string | null;
};

export type AwardWinnerDemo = {
  id: string;
  name: string;
  description?: string | null;
  url?: string | null;
};

export type AwardWinnerDisplay = {
  name: string;
  description: string | null;
  url: string | null;
  demoId: string | null;
};

export function awardHasWinner(award: AwardWinnerSource): boolean {
  return Boolean(award.winnerId ?? award.winnerName?.trim());
}

export function getAwardWinner(
  award: AwardWinnerSource,
  demos: AwardWinnerDemo[],
): AwardWinnerDisplay | null {
  if (award.winnerId) {
    const demo = demos.find((d) => d.id === award.winnerId);
    if (demo) {
      return {
        name: demo.name,
        description: demo.description ?? null,
        url: demo.url ?? null,
        demoId: demo.id,
      };
    }
  }

  const customName = award.winnerName?.trim();
  if (customName) {
    return {
      name: customName,
      description: null,
      url: null,
      demoId: null,
    };
  }

  return null;
}
