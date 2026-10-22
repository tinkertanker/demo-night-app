import { type Attendee, type Vote } from "@prisma/client";
import { useEffect, useState } from "react";

import { api } from "~/trpc/react";

export type LocalVote = Omit<Vote, "id" | "createdAt" | "updatedAt">;
export type VoteByAwardId = Record<string, LocalVote>;

export function useVotes(
  eventId: string,
  attendee: Attendee,
  categories = false,
) {
  const [votes, setVotes] = useState<VoteByAwardId>(
    getLocalVotes(eventId, attendee.id),
  );
  const { data: votesData } = api.vote.all.useQuery({
    eventId,
    attendeeId: attendee.id,
  });
  const upsertMutation = api.vote.upsert.useMutation();

  useEffect(() => {
    setLocalVotes(eventId, attendee.id, votes);
  }, [eventId, attendee.id, votes]);

  useEffect(() => {
    if (votesData) {
      // Convert array to VoteByAwardId format (for demo nights with one vote per award)
      const votesMap = votesData.reduce((acc, vote) => {
        acc[vote.awardId] = vote;
        return acc;
      }, {} as VoteByAwardId);
      setVotes(votesMap);
    }
  }, [votesData]);

  const setVote = (awardId: string, demoId: string | null) => {
    const updatedVotes = { ...votes };
    const vote =
      updatedVotes[awardId] ?? emptyVote(eventId, attendee.id, awardId);
    vote.demoId = demoId;

    // Ensure no other award is voting for the same demoId
    if (demoId !== null && !categories) {
      Object.keys(updatedVotes).forEach((key) => {
        if (key !== awardId && updatedVotes[key]?.demoId === demoId) {
          updatedVotes[key]!.demoId = null;
          upsertMutation.mutate(updatedVotes[key]!);
        }
      });
    }

    updatedVotes[awardId] = vote;
    setVotes(updatedVotes);
    upsertMutation.mutate(vote);
  };

  return { votes, setVote };
}

function emptyVote(
  eventId: string,
  attendeeId: string,
  awardId: string,
): LocalVote {
  return {
    eventId,
    attendeeId,
    awardId,
    demoId: null,
    amount: null,
  };
}

function getLocalVotes(eventId: string, attendeeId: string): VoteByAwardId {
  if (typeof window !== "undefined") {
    const votes =
      localStorage.getItem(`votes:${eventId}:${attendeeId}`) ??
      localStorage.getItem(`votes:${eventId}`);
    if (votes)
      return Object.fromEntries(
        Object.entries(JSON.parse(votes) as VoteByAwardId).filter(
          ([, vote]) =>
            vote.attendeeId === attendeeId && vote.eventId === eventId,
        ),
      );
  }
  return {};
}

function setLocalVotes(
  eventId: string,
  attendeeId: string,
  votes: VoteByAwardId,
) {
  if (typeof window === "undefined") return; // SSR guard
  localStorage.setItem(`votes:${eventId}:${attendeeId}`, JSON.stringify(votes));
}
