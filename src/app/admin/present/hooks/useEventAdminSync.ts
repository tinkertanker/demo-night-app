import { useEffect } from "react";

import { liveQueryOptions } from "~/lib/liveQuery";
import { type CurrentEvent } from "~/lib/types/currentEvent";
import { api } from "~/trpc/react";

export default function useEventAdminSync(initialCurrentEvent: CurrentEvent) {
  const { data: currentEvent, refetch: refetchCurrentEvent } =
    api.event.getCurrent.useQuery<CurrentEvent>(undefined, {
      initialData: initialCurrentEvent,
      ...liveQueryOptions(),
    });

  const { data: event, refetch: refetchEvent } = api.event.getAdmin.useQuery(
    currentEvent?.id ?? "",
    {
      enabled: !!currentEvent,
    },
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
