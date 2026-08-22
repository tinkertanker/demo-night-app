import { type AdminEvent } from "../contexts/DashboardContext";

import { liveQueryOptions } from "~/lib/liveQuery";
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
    api.event.getCurrent.useQuery(undefined, {
      initialData: initialCurrentEvent,
    });
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
