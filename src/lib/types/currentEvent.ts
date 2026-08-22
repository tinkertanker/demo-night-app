import { kv } from "@vercel/kv";

import { type EventConfig } from "./eventConfig";

export enum EventPhase {
  Pre,
  Demos,
  Voting,
  Results,
  Recap,
}

export const allPhases = [
  EventPhase.Pre,
  EventPhase.Demos,
  EventPhase.Voting,
  EventPhase.Results,
  EventPhase.Recap,
];

export function displayName(phase: EventPhase, isPitchNight = false): string {
  switch (phase) {
    case EventPhase.Pre:
      return isPitchNight ? "Pre-Pitches" : "Pre-Demos";
    case EventPhase.Demos:
      return isPitchNight ? "Pitches" : "Demos";
    case EventPhase.Voting:
      return isPitchNight ? "Investing" : "Voting";
    case EventPhase.Results:
      return "Results";
    case EventPhase.Recap:
      return "Recap";
  }
}

export type CurrentEvent = {
  id: string;
  name: string;
  phase: EventPhase;
  currentDemoId: string | null;
  currentAwardId: string | null;
  isPitchNight: boolean;
};

export type CurrentEventDateRecord = {
  eventId: string;
  date: string;
};

const CURRENT_EVENT_KEY = "currentEvent";
const CURRENT_EVENT_DATE_KEY = "currentEventDate";

export async function getCurrentEvent(): Promise<CurrentEvent | null> {
  return await kv.get(CURRENT_EVENT_KEY);
}

export async function getCurrentEventDateRecord(): Promise<CurrentEventDateRecord | null> {
  return await kv.get(CURRENT_EVENT_DATE_KEY);
}

async function setCurrentEventDate(eventId: string, date: Date) {
  return kv.set(CURRENT_EVENT_DATE_KEY, {
    eventId,
    date: date.toISOString(),
  } satisfies CurrentEventDateRecord);
}

export async function updateCurrentEvent(
  event: { id: string; name: string; config?: any; date?: Date } | null,
) {
  if (!event) {
    await kv.set(CURRENT_EVENT_KEY, null);
    await kv.del(CURRENT_EVENT_DATE_KEY);
    return;
  }

  const currentEvent = await getCurrentEvent();
  if (currentEvent && currentEvent.id === event.id) {
    if (event.date) {
      await setCurrentEventDate(event.id, event.date);
    }
    return;
  }

  const config = event.config as EventConfig | undefined;
  const isPitchNight = config?.isPitchNight ?? false;

  await kv.set(CURRENT_EVENT_KEY, {
    id: event.id,
    name: event.name,
    phase: EventPhase.Pre,
    currentDemoId: null,
    currentAwardId: null,
    isPitchNight,
  } satisfies CurrentEvent);

  if (event.date) {
    await setCurrentEventDate(event.id, event.date);
  } else {
    await kv.del(CURRENT_EVENT_DATE_KEY);
  }
}

export async function updateCurrentEventState({
  phase,
  currentDemoId,
  currentAwardId,
}: {
  phase?: EventPhase;
  currentDemoId?: string | null;
  currentAwardId?: string | null;
}) {
  const currentEvent = await getCurrentEvent();
  if (!currentEvent) {
    throw new Error("No current event");
  }
  if (phase !== undefined) {
    currentEvent.phase = phase;
  }
  if (currentDemoId !== undefined) {
    currentEvent.currentDemoId = currentDemoId;
  }
  if (currentAwardId !== undefined) {
    currentEvent.currentAwardId = currentAwardId;
  }
  return kv.set(CURRENT_EVENT_KEY, currentEvent);
}
