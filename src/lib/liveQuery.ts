import { env } from "~/env";

export const LIVE_REFRESH_INTERVAL =
  env.NEXT_PUBLIC_NODE_ENV === "development" ? 1_000 : 5_000;

export function liveQueryOptions(enabled = true) {
  return {
    refetchInterval: enabled ? LIVE_REFRESH_INTERVAL : false,
    staleTime: LIVE_REFRESH_INTERVAL,
  } as const;
}
