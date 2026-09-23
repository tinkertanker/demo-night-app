import { useEffect, useRef } from "react";

import { liveQueryOptions } from "~/lib/liveQuery";
import { type CurrentEvent } from "~/lib/types/currentEvent";
import { api } from "~/trpc/react";

export default function useEventAdminSync(initialCurrentEvent: CurrentEvent) {
  const { data: liveEvent, refetch: refetchCurrentEvent } =
    api.event.getLiveEvent.useQuery<CurrentEvent | null>(
      initialCurrentEvent.id,
      {
        initialData: initialCurrentEvent,
        ...liveQueryOptions(),
      },
    );
  // Keep showing the last live state if the event stops being live mid-show.
  const lastLiveEvent = useRef(initialCurrentEvent);
  if (lastLiveEvent.current.id !== initialCurrentEvent.id) {
    lastLiveEvent.current = initialCurrentEvent;
  }
  if (liveEvent) {
    lastLiveEvent.current = liveEvent;
  }
  const currentEvent = liveEvent ?? lastLiveEvent.current;

  const { data: event, refetch: refetchEvent } = api.event.getAdmin.useQuery(
    currentEvent.id,
  );

  const refetch = () => {
    refetchCurrentEvent();
    refetchEvent();
  };

  useEffect(() => {
    refetchEvent();
  }, [currentEvent.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  return { currentEvent, event: event!, refetch };
}
