import { env } from "~/env";

export const LIVE_REFRESH_INTERVAL =
  env.NEXT_PUBLIC_NODE_ENV === "development" ? 1_000 : 5_000;

export function liveQueryOptions(enabled = true) {
  return enabled
    ? {
        refetchInterval: LIVE_REFRESH_INTERVAL,
        staleTime: LIVE_REFRESH_INTERVAL,
      }
    : {
        refetchInterval: false as const,
      };
}
