export const DEFAULT_AWARDS = [
  {
    name: "TokenMaxxer",
    description: "",
    index: 0,
    votable: false,
  },
  {
    name: "💰 Top Funded",
    description:
      "The company that received the most investment from the crowd!",
    index: 1,
    votable: true,
    winnerRank: 1,
  },
  {
    name: "🥈 Runner-Up",
    description: "2nd place!",
    index: 2,
    votable: false,
    winnerRank: 2,
  },
  {
    name: "🥉 2nd Runner-Up",
    description: "3rd place!",
    index: 3,
    votable: false,
    winnerRank: 3,
  },
];

export const PITCH_NIGHT_AWARDS = DEFAULT_AWARDS;

export const CATEGORY_AWARDS = [
  {
    name: "💡 Most Creative",
    description: "An original idea that surprised you.",
    index: 0,
    votable: true,
  },
  {
    name: "🛠️ Most Useful",
    description: "A project that makes a real difference.",
    index: 1,
    votable: true,
  },
  {
    name: "🎤 Best Explanation",
    description: "A clear and engaging presentation.",
    index: 2,
    votable: true,
  },
];

export function stickerAwardId(
  awards: { id: string; votable: boolean; winnerRank: number | null }[],
) {
  return (
    awards.find((award) => award.votable && award.winnerRank === 1) ??
    awards.find((award) => award.votable)
  )?.id;
}
