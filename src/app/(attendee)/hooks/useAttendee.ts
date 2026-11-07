import { type Attendee } from "@prisma/client";
import { useEffect, useState } from "react";

import { attendeeNameSchema } from "~/lib/voters";
import { api } from "~/trpc/react";

export function useAttendee(eventId: string) {
  const [attendee, setAttendee] = useState<Attendee>(() =>
    getLocalAttendee(eventId),
  );
  const utils = api.useUtils();
  const {
    data: attendeeData,
    isError,
    refetch,
  } = api.attendee.upsert.useQuery({
    id: attendee.id,
    eventId: eventId,
  });
  const updateMutation = api.attendee.update.useMutation();

  useEffect(() => {
    setLocalAttendee(eventId, attendee);
  }, [eventId, attendee]);

  useEffect(() => {
    if (attendeeData) {
      setAttendee(attendeeData);
    }
  }, [attendeeData]);

  async function updateAttendee(next: Attendee) {
    const saved = await updateMutation.mutateAsync({
      id: next.id,
      name: attendeeNameSchema.parse(next.name),
    });
    utils.attendee.upsert.setData({ id: saved.id, eventId }, saved);
    rememberName(saved.name);
    setAttendee(saved);
    await utils.attendee.votingStatus.invalidate({
      eventId,
      attendeeId: saved.id,
    });
  }

  return {
    attendee,
    setAttendee: updateAttendee,
    ready: !!attendeeData,
    isError,
    refetch,
  };
}

// Each event gets its own attendee, so a name given at one event is never
// attached to votes or feedback from another. Only the typed name is
// remembered across events, in this browser, to prefill the name form.
const NAME_KEY = "attendeeName";
const LEGACY_ATTENDEE_KEY = "attendee";

const attendeeKey = (eventId: string) => `attendee:${eventId}`;

// Keep only what the app still collects; older records may also hold an
// email, LinkedIn and attendee type.
function parseLocalAttendee(json: string): Attendee {
  const { id, name } = JSON.parse(json) as Attendee;
  return { id, name, email: null, linkedin: null, type: null };
}

export function rememberedName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberName(name: string | null) {
  if (!name?.trim()) return;
  try {
    localStorage.setItem(NAME_KEY, name.trim());
  } catch {}
}

function getLocalAttendee(eventId: string): Attendee {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(attendeeKey(eventId));
    if (stored) {
      const attendee = parseLocalAttendee(stored);
      setLocalAttendee(eventId, attendee);
      return attendee;
    }
    const legacy = migrateLegacyAttendee(eventId);
    if (legacy) return legacy;
    // Another tab may have created this event's attendee meanwhile.
    const current = localStorage.getItem(attendeeKey(eventId));
    if (current) return parseLocalAttendee(current);
  }
  const attendee = {
    id: crypto.randomUUID(),
    name: null,
    email: null,
    linkedin: null,
    type: null,
  };
  setLocalAttendee(eventId, attendee);
  return attendee;
}

// One-off migration from the old device-wide attendee. Every event it already
// has local votes or feedback for keeps that id, so earlier participation is
// not orphaned. The current event reuses it only if it is one of those events,
// or if there are none; otherwise it gets a fresh id so events stay separate.
// The legacy key is removed only after the per-event copies are written.
function migrateLegacyAttendee(eventId: string): Attendee | null {
  try {
    const legacy = localStorage.getItem(LEGACY_ATTENDEE_KEY);
    if (!legacy) return null;
    const attendee = parseLocalAttendee(legacy);
    const suffix = `:${attendee.id}`;
    const eventIds = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const match = key?.endsWith(suffix)
        ? /^(?:votes|feedback|feedback-drafts):(.+)$/.exec(
            key.slice(0, -suffix.length),
          )
        : null;
      if (match?.[1]) eventIds.add(match[1]);
    }
    if (eventIds.size === 0) eventIds.add(eventId);
    for (const id of eventIds) {
      if (!localStorage.getItem(attendeeKey(id)))
        setLocalAttendee(id, attendee);
    }
    rememberName(attendee.name);
    localStorage.removeItem(LEGACY_ATTENDEE_KEY);
    return eventIds.has(eventId) ? attendee : null;
  } catch {
    return null;
  }
}

function setLocalAttendee(eventId: string, attendee: Attendee) {
  if (typeof window === "undefined") return; // SSR guard
  localStorage.setItem(attendeeKey(eventId), JSON.stringify(attendee));
}
