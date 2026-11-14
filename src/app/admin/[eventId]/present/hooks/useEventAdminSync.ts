import { useEffect, useState } from "react";

import {
  LIVE_REFRESH_INTERVAL,
  useLiveActivity,
} from "~/lib/liveQuery";
import { type CurrentEvent } from "~/lib/types/currentEvent";
import { api } from "~/trpc/react";

export default function useEventAdminSync(initialCurrentEvent: CurrentEvent) {
  const { data: liveEvent, refetch: refetchCurrentEvent } =
    api.event.getLiveEvent.useQuery<CurrentEvent | null>(
      initialCurrentEvent.id,
      {
        initialData: initialCurrentEvent,
        // Once the event stops, check again only when the tab regains focus.
        refetchInterval: (query) =>
          query.state.data ? LIVE_REFRESH_INTERVAL : false,
        staleTime: LIVE_REFRESH_INTERVAL,
      },
    );
  // Keep showing the last live state if the event stops being live mid-show.
  const [lastLiveEvent, setLastLiveEvent] = useState(initialCurrentEvent);
  useEffect(() => {
    if (liveEvent) setLastLiveEvent(liveEvent);
  }, [liveEvent]);
  const currentEvent =
    liveEvent ??
    (lastLiveEvent.id === initialCurrentEvent.id
      ? lastLiveEvent
      : initialCurrentEvent);

  useLiveActivity([
    currentEvent.phase,
    currentEvent.currentDemoId,
    currentEvent.currentAwardId,
  ]);

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
