import { useEffect } from "react";

import { liveQueryOptions, useLiveActivity } from "~/lib/liveQuery";
import { type CurrentEvent } from "~/lib/types/currentEvent";
import { api } from "~/trpc/react";

export default function useEventSync(initialCurrentEvent: CurrentEvent) {
  const { data: currentEvent } =
    api.event.getLiveActive.useQuery<CurrentEvent | null>(
      initialCurrentEvent.id,
      {
        initialData: initialCurrentEvent,
        ...liveQueryOptions(),
      },
    );

  useLiveActivity([
    currentEvent?.phase,
    currentEvent?.currentDemoId,
    currentEvent?.currentAwardId,
  ]);

  const { data: event, refetch: refetchEvent } = api.event.get.useQuery(
    currentEvent?.id ?? "",
    {
      enabled: !!currentEvent,
    },
  );

  useEffect(() => {
    if (!currentEvent) return;
    refetchEvent();
  }, [currentEvent?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  return { currentEvent, event: event!, refetchEvent };
}
