import { type AdminEvent } from "../contexts/DashboardContext";

import {
  LIVE_REFRESH_INTERVAL,
  liveQueryOptions,
  useLiveActivity,
} from "~/lib/liveQuery";
import { type CurrentEvent } from "~/lib/types/currentEvent";
import { api } from "~/trpc/react";

export function useEventAdmin({
  initialEvent,
  initialCurrentEvent,
}: {
  initialEvent?: AdminEvent;
  initialCurrentEvent?: CurrentEvent | null;
}) {
  const { data: currentEvent, refetch: refetchCurrentEvent } =
    api.event.getLiveEvent.useQuery(initialEvent?.id ?? "", {
      enabled: !!initialEvent?.id,
      initialData: initialCurrentEvent,
      // Poll while live so show progress driven from the presenter view
      // counts as activity and keeps this dashboard updating
      refetchInterval: (query) =>
        query.state.data ? LIVE_REFRESH_INTERVAL : false,
      staleTime: LIVE_REFRESH_INTERVAL,
    });
  useLiveActivity([
    currentEvent?.phase,
    currentEvent?.currentDemoId,
    currentEvent?.currentAwardId,
  ]);
  const { data: event, refetch: refetchEvent } = api.event.getAdmin.useQuery(
    initialEvent?.id ?? "",
    {
      enabled: !!initialEvent?.id,
      ...liveQueryOptions(currentEvent?.id === initialEvent?.id),
      initialData: initialEvent,
    },
  );

  const refetch = () => {
    refetchCurrentEvent();
    refetchEvent();
  };

  return { currentEvent, event, refetch };
}
