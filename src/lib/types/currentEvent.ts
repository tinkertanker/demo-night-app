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

// A live event as attendees and presenters see it. Several events can be live at
// once; attendees pick theirs with its join code.
export type CurrentEvent = {
  id: string;
  name: string;
  phase: EventPhase;
  currentDemoId: string | null;
  currentAwardId: string | null;
  isPitchNight: boolean;
  // Overlaid from the database by the event router; not stored in KV.
  joinCode?: string | null;
};

type StoredLiveEvent = Omit<CurrentEvent, "joinCode">;

// Callers must hold lockCurrentEventState while changing the set of live events,
// and lockVotingEvent(eventId) while changing one live event's state.
const LIVE_EVENT_IDS_KEY = "liveEventIds";
const liveEventKey = (eventId: string) => `liveEvent:${eventId}`;

// Before multi-event support there was a single live event under these keys.
const LEGACY_CURRENT_EVENT_KEY = "currentEvent";
const LEGACY_CURRENT_EVENT_DATE_KEY = "currentEventDate";

export async function getLiveEventIds(): Promise<string[]> {
  const ids = await kv.get<string[]>(LIVE_EVENT_IDS_KEY);
  if (ids) return ids;
  await migrateLegacyCurrentEvent();
  return (await kv.get<string[]>(LIVE_EVENT_IDS_KEY)) ?? [];
}

export async function getLiveEvent(
  eventId: string,
): Promise<StoredLiveEvent | null> {
  const ids = await getLiveEventIds();
  if (!ids.includes(eventId)) return null;
  const stored = await kv.get<StoredLiveEvent>(liveEventKey(eventId));
  if (!stored) return null;
  return { ...stored, isPitchNight: stored.isPitchNight ?? false };
}

export async function getLiveEvents(): Promise<StoredLiveEvent[]> {
  const ids = await getLiveEventIds();
  const events = await Promise.all(ids.map((id) => getLiveEvent(id)));
  return events.filter((event): event is StoredLiveEvent => !!event);
}

// Makes the event live, or refreshes its details if it already is. The
// presentation state (current demo/award) survives a refresh.
export async function startLiveEvent(
  event: { id: string; name: string; config?: any },
  phase: EventPhase,
) {
  const existing = await kv.get<StoredLiveEvent>(liveEventKey(event.id));
  const config = event.config as EventConfig | undefined;

  await kv.set(liveEventKey(event.id), {
    id: event.id,
    name: event.name,
    phase,
    currentDemoId: existing?.currentDemoId ?? null,
    currentAwardId: existing?.currentAwardId ?? null,
    isPitchNight: config?.isPitchNight ?? false,
  } satisfies StoredLiveEvent);

  const ids = await getLiveEventIds();
  if (!ids.includes(event.id)) {
    await kv.set(LIVE_EVENT_IDS_KEY, [...ids, event.id]);
  }
}

export async function stopLiveEvent(eventId: string) {
  const ids = await getLiveEventIds();
  await kv.set(
    LIVE_EVENT_IDS_KEY,
    ids.filter((id) => id !== eventId),
  );
  await kv.del(liveEventKey(eventId));
}

export async function updateLiveEventState(
  eventId: string,
  {
    phase,
    currentDemoId,
    currentAwardId,
  }: {
    phase?: EventPhase;
    currentDemoId?: string | null;
    currentAwardId?: string | null;
  },
) {
  const liveEvent = await getLiveEvent(eventId);
  if (!liveEvent) {
    throw new Error("Event is not live");
  }
  if (phase !== undefined) {
    liveEvent.phase = phase;
  }
  if (currentDemoId !== undefined) {
    liveEvent.currentDemoId = currentDemoId;
  }
  if (currentAwardId !== undefined) {
    liveEvent.currentAwardId = currentAwardId;
  }
  return kv.set(liveEventKey(eventId), liveEvent);
}

// Moves a live event stored under the old singleton keys into the new layout.
// Writes use NX so a concurrent migration or start can't be clobbered.
async function migrateLegacyCurrentEvent() {
  const legacy = await kv.get<StoredLiveEvent>(LEGACY_CURRENT_EVENT_KEY);
  if (!legacy) {
    await kv.set(LIVE_EVENT_IDS_KEY, [], { nx: true });
    return;
  }

  await kv.set(
    liveEventKey(legacy.id),
    {
      id: legacy.id,
      name: legacy.name,
      phase: legacy.phase,
      currentDemoId: legacy.currentDemoId,
      currentAwardId: legacy.currentAwardId,
      isPitchNight: legacy.isPitchNight ?? false,
    } satisfies StoredLiveEvent,
    { nx: true },
  );
  await kv.set(LIVE_EVENT_IDS_KEY, [legacy.id], { nx: true });
  await kv.del(LEGACY_CURRENT_EVENT_KEY, LEGACY_CURRENT_EVENT_DATE_KEY);
}
