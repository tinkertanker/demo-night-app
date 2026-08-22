import { useEffect } from "react";

import { liveQueryOptions } from "~/lib/liveQuery";
import { type CurrentEvent } from "~/lib/types/currentEvent";
import { api } from "~/trpc/react";

export default function useEventSync(initialCurrentEvent: CurrentEvent) {
  const { data: currentEvent } =
    api.event.getCurrentActive.useQuery<CurrentEvent | null>(undefined, {
      initialData: initialCurrentEvent,
      ...liveQueryOptions(),
    });

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
