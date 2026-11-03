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
  const utils = api.useUtils();
  const upsertMutation = api.vote.upsert.useMutation();
  // The mutation observer only reflects the latest call, so count writes
  // ourselves: a quick second pick must not hide an earlier failure.
  const [pending, setPending] = useState(0);
  const [failedAwardIds, setFailedAwardIds] = useState<Set<string>>(
    () => new Set(),
  );

  const save = (vote: LocalVote) => {
    const awardId = vote.awardId;
    setPending((n) => n + 1);
    upsertMutation
      .mutateAsync(vote)
      .then(() =>
        setFailedAwardIds((ids) => {
          const next = new Set(ids);
          next.delete(awardId);
          return next;
        }),
      )
      .catch(() => {
        setFailedAwardIds((ids) => new Set(ids).add(awardId));
        // Show what the server actually has for the failed award.
        void utils.vote.all.invalidate({ eventId, attendeeId: attendee.id });
      })
      .finally(() => setPending((n) => n - 1));
  };

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
          save(updatedVotes[key]!);
        }
      });
    }

    updatedVotes[awardId] = vote;
    setVotes(updatedVotes);
    save(vote);
  };

  return {
    votes,
    setVote,
    saving: pending > 0,
    saveFailed: failedAwardIds.size > 0,
  };
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
