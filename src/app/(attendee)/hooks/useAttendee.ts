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
      ...next,
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
    if (stored) return JSON.parse(stored) as Attendee;
    // One-off migration from the old device-wide attendee: keep it for the
    // event in progress so its votes and feedback stay, then retire it.
    const legacy = localStorage.getItem(LEGACY_ATTENDEE_KEY);
    if (legacy) {
      localStorage.removeItem(LEGACY_ATTENDEE_KEY);
      const attendee = JSON.parse(legacy) as Attendee;
      rememberName(attendee.name);
      setLocalAttendee(eventId, attendee);
      return attendee;
    }
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

function setLocalAttendee(eventId: string, attendee: Attendee) {
  if (typeof window === "undefined") return; // SSR guard
  localStorage.setItem(attendeeKey(eventId), JSON.stringify(attendee));
}
