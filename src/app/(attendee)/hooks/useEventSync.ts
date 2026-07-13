import { useEffect } from "react";

import { type CurrentEvent } from "~/lib/types/currentEvent";
import { api } from "~/trpc/react";

import { env } from "~/env";

const REFRESH_INTERVAL =
  env.NEXT_PUBLIC_NODE_ENV === "development" ? 1_000 : 5_000;

export default function useEventSync(initialCurrentEvent: CurrentEvent) {
  const { data: currentEvent } =
    api.event.getCurrentActive.useQuery<CurrentEvent | null>(undefined, {
      initialData: initialCurrentEvent,
      refetchInterval: REFRESH_INTERVAL,
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
