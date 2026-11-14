import { type Attendee, type Feedback } from "@prisma/client";
import { useEffect, useRef, useState } from "react";

import { postcardFields } from "~/lib/postcards";
import { type PublicDemo } from "~/server/api/routers/event";
import { api } from "~/trpc/react";

export type LocalFeedback = Omit<Feedback, "id" | "createdAt" | "updatedAt">;
export type FeedbackByDemoId = Record<string, LocalFeedback>;

export enum FeedbackSaveStatus {
  UNSAVED,
  SAVING,
  SAVED,
}

export function useFeedback(
  eventId: string,
  attendee: Attendee,
  selectedDemo: PublicDemo,
) {
  const pending = useRef<FeedbackByDemoId>(
    getLocalFeedbackByDemoId(eventId, attendee.id, true),
  );
  const [feedbackByDemoId, setFeedbackByDemoId] = useState<FeedbackByDemoId>(
    () => ({
      ...getLocalFeedbackByDemoId(eventId, attendee.id),
      ...pending.current,
    }),
  );
  const { data: allFeedbackData } = api.feedback.all.useQuery({
    eventId,
    attendeeId: attendee.id,
  });
  const queue = useRef(Promise.resolve());
  const utils = api.useUtils();
  const feedback =
    feedbackByDemoId[selectedDemo.id] ??
    emptyFeedback(eventId, attendee.id, selectedDemo.id);
  const setFeedback = (next: LocalFeedback) => {
    pending.current[next.demoId] = next;
    setLocalFeedbackByDemoId(
      eventId,
      attendee.id,
      {
        ...getLocalFeedbackByDemoId(eventId, attendee.id, true),
        [next.demoId]: next,
      },
      true,
    );
    setFeedbackByDemoId((previous) => ({ ...previous, [next.demoId]: next }));
    setSaveStatus(FeedbackSaveStatus.UNSAVED);
  };
  const upsertMutation = api.feedback.upsert.useMutation();
  const [saveStatus, setSaveStatus] = useState<FeedbackSaveStatus>(
    FeedbackSaveStatus.UNSAVED,
  );

  const save = () => {
    const changes = Object.values(pending.current);
    if (!changes.length) return;
    setSaveStatus(FeedbackSaveStatus.SAVING);
    // Serialize snapshots so a slow earlier save cannot overwrite later edits.
    queue.current = queue.current
      .catch(() => undefined)
      .then(async () => {
        for (const item of changes) {
          const saved = await upsertMutation.mutateAsync({
            ...item,
            badges: postcardFields.badges.parse(item.badges),
          });
          utils.feedback.all.setData(
            { eventId, attendeeId: attendee.id },
            (previous) => ({ ...previous, [saved.demoId]: saved }),
          );
          if (pending.current[item.demoId] === item)
            delete pending.current[item.demoId];
          // A newer workspace may have edited this draft while the save ran.
          const drafts = getLocalFeedbackByDemoId(eventId, attendee.id, true);
          const fields = Object.keys(item).sort();
          if (
            JSON.stringify(drafts[item.demoId], fields) ===
            JSON.stringify(item, fields)
          ) {
            delete drafts[item.demoId];
            setLocalFeedbackByDemoId(eventId, attendee.id, drafts, true);
          }
        }
        if (!Object.keys(pending.current).length)
          setSaveStatus(FeedbackSaveStatus.SAVED);
      })
      .catch(() => setSaveStatus(FeedbackSaveStatus.UNSAVED));
  };
  const saveOnExit = useRef(save);
  saveOnExit.current = save;
  useEffect(() => () => saveOnExit.current(), []);

  useEffect(() => {
    setLocalFeedbackByDemoId(eventId, attendee.id, feedbackByDemoId);
  }, [eventId, attendee.id, feedbackByDemoId]);

  useEffect(() => {
    if (allFeedbackData) {
      setFeedbackByDemoId({ ...allFeedbackData, ...pending.current });
      if (!Object.keys(pending.current).length)
        setSaveStatus(FeedbackSaveStatus.SAVED);
    }
  }, [allFeedbackData]);

  useEffect(() => {
    const handler = setTimeout(save, 800);

    return () => {
      clearTimeout(handler);
    };
  }, [feedbackByDemoId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { feedbackByDemoId, feedback, setFeedback, saveStatus, save };
}

function emptyFeedback(
  eventId: string,
  attendeeId: string,
  demoId: string,
): LocalFeedback {
  return {
    eventId,
    attendeeId,
    demoId,
    rating: null,
    claps: 0,
    cheers: 0,
    confetti: 0,
    comment: null,
    liked: null,
    wonder: null,
    tryNext: null,
    badges: [],
  };
}

function getLocalFeedbackByDemoId(
  eventId: string,
  attendeeId: string,
  draftsOnly = false,
): FeedbackByDemoId {
  if (typeof window !== "undefined") {
    const stored =
      localStorage.getItem(
        `${draftsOnly ? "feedback-drafts" : "feedback"}:${eventId}:${attendeeId}`,
      ) ?? (draftsOnly ? null : localStorage.getItem(`feedback:${eventId}`));
    if (stored) {
      const parsed = JSON.parse(stored) as FeedbackByDemoId;
      return Object.fromEntries(
        Object.entries(parsed)
          .filter(
            ([, item]) =>
              item.attendeeId === attendeeId && item.eventId === eventId,
          )
          .map(([id, item]) => [
            id,
            { ...emptyFeedback(eventId, attendeeId, id), ...item },
          ]),
      );
    }
  }
  return {};
}

function setLocalFeedbackByDemoId(
  eventId: string,
  attendeeId: string,
  feedbackByDemoId: FeedbackByDemoId,
  draftsOnly = false,
) {
  if (typeof window === "undefined") return; // SSR guard
  localStorage.setItem(
    `${draftsOnly ? "feedback-drafts" : "feedback"}:${eventId}:${attendeeId}`,
    JSON.stringify(feedbackByDemoId),
  );
}
