import { type Attendee, type Vote } from "@prisma/client";
import { useEffect, useRef, useState } from "react";

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
  // Saves run one at a time in tap order, so an older pick can never
  // commit after a newer one.
  const upsertMutation = api.vote.upsert.useMutation({
    scope: { id: `votes:${eventId}:${attendee.id}` },
  });
  // The mutation observer only reflects the latest call, so count writes
  // ourselves: a quick second pick must not hide an earlier failure.
  const [pending, setPending] = useState(0);
  const inFlight = useRef(0);
  const [failedAwardIds, setFailedAwardIds] = useState<Set<string>>(
    () => new Set(),
  );

  const save = (vote: LocalVote) => {
    const awardId = vote.awardId;
    inFlight.current += 1;
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
      .catch(() => setFailedAwardIds((ids) => new Set(ids).add(awardId)))
      .finally(() => {
        setPending((n) => n - 1);
        inFlight.current -= 1;
        // Resync with the server once no other pick is still saving, so a
        // refetch cannot overwrite a selection on its way. This also cancels
        // any older refetch that would otherwise land after a newer pick.
        if (inFlight.current === 0) {
          void utils.vote.all.invalidate({ eventId, attendeeId: attendee.id });
        }
      });
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

    // Ensure no other award is voting for the same demoId. Only clear it
    // locally: the server moves the project in the same transaction as the
    // new pick, so a failed pick never loses the old vote.
    if (demoId !== null && !categories) {
      Object.keys(updatedVotes).forEach((key) => {
        if (key !== awardId && updatedVotes[key]?.demoId === demoId) {
          updatedVotes[key] = { ...updatedVotes[key]!, demoId: null };
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
