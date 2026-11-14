import { type EventConfig } from "~/lib/types/eventConfig";
import {
  type CurrentEvent,
  EventPhase,
  allPhases,
} from "~/lib/types/currentEvent";
import { type Prisma } from "@prisma/client";

import { db } from "~/server/db";

export { type CurrentEvent, EventPhase, allPhases };

type StoredLiveEvent = Omit<CurrentEvent, "joinCode">;

// Pass the transaction client when calling from inside a transaction, so the
// call doesn't need a second connection while the transaction holds a lock.
type Client = Pick<Prisma.TransactionClient, "liveEvent">;

// Callers must hold lockCurrentEventState while changing the set of live events,
// and lockVotingEvent(eventId) while changing one live event's state.
// A LiveEvent row exists only while its event is live.

const toStored = (row: {
  eventId: string;
  name: string;
  phase: number;
  currentDemoId: string | null;
  currentAwardId: string | null;
  isPitchNight: boolean;
}): StoredLiveEvent => ({
  id: row.eventId,
  name: row.name,
  phase: row.phase as EventPhase,
  currentDemoId: row.currentDemoId,
  currentAwardId: row.currentAwardId,
  isPitchNight: row.isPitchNight,
});

export async function getLiveEventIds(client: Client = db): Promise<string[]> {
  const rows = await client.liveEvent.findMany({
    select: { eventId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => row.eventId);
}

export async function getLiveEvent(
  eventId: string,
  client: Client = db,
): Promise<StoredLiveEvent | null> {
  const row = await client.liveEvent.findUnique({ where: { eventId } });
  return row ? toStored(row) : null;
}

export async function getLiveEvents(): Promise<StoredLiveEvent[]> {
  const rows = await db.liveEvent.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toStored);
}

// Makes the event live, or refreshes its details if it already is. The
// presentation state (current demo/award) survives a refresh.
export async function startLiveEvent(
  event: { id: string; name: string; config?: any },
  phase: EventPhase,
  client: Client = db,
) {
  const config = event.config as EventConfig | undefined;
  const details = {
    name: event.name,
    phase,
    isPitchNight: config?.isPitchNight ?? false,
  };
  await client.liveEvent.upsert({
    where: { eventId: event.id },
    create: { eventId: event.id, ...details },
    update: details,
  });
}

export async function stopLiveEvent(eventId: string, client: Client = db) {
  await client.liveEvent.deleteMany({ where: { eventId } });
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
  client: Client = db,
) {
  const { count } = await client.liveEvent.updateMany({
    where: { eventId },
    data: { phase, currentDemoId, currentAwardId },
  });
  if (count === 0) {
    throw new Error("Event is not live");
  }
}
