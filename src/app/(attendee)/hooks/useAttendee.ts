import { type Attendee } from "@prisma/client";
import { useEffect, useState } from "react";

import { attendeeNameSchema } from "~/lib/voters";
import { api } from "~/trpc/react";

export function useAttendee(eventId: string) {
  const [attendee, setAttendee] = useState<Attendee>(getLocalAttendee);
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
    setLocalAttendee(attendee);
  }, [attendee]);

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

function getLocalAttendee(): Attendee {
  if (typeof window !== "undefined") {
    const attendee = localStorage.getItem("attendee");
    if (attendee) return JSON.parse(attendee);
  }
  const attendee = {
    id: crypto.randomUUID(),
    name: null,
    email: null,
    linkedin: null,
    type: null,
  };
  setLocalAttendee(attendee);
  return attendee;
}

function setLocalAttendee(attendee: Attendee) {
  if (typeof window === "undefined") return; // SSR guard
  localStorage.setItem("attendee", JSON.stringify(attendee));
}
