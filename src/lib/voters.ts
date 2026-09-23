import { z } from "zod";

export const attendeeNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter your name");

export function duplicateVoterIds(
  voters: { id: string; name: string | null }[],
) {
  const idsByName = new Map<string, string[]>();
  for (const voter of voters) {
    const name = voter.name
      ?.normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (!name) continue;
    idsByName.set(name, [...(idsByName.get(name) ?? []), voter.id]);
  }
  return new Set(
    [...idsByName.values()].filter((ids) => ids.length > 1).flat(),
  );
}

export function investmentParticipation(
  votes: { attendeeId: string; demoId: string | null; amount: number | null }[],
) {
  const allocations = votes.filter(
    (vote) => vote.demoId && (vote.amount ?? 0) > 0,
  );
  return {
    investors: new Set(allocations.map((vote) => vote.attendeeId)).size,
    allocations: allocations.length,
  };
}
