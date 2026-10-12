import { focusManager } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { env } from "~/env";
import { createIdleMonitor } from "~/lib/idleMonitor";

export const LIVE_REFRESH_INTERVAL =
  env.NEXT_PUBLIC_NODE_ENV === "development" ? 1_000 : 5_000;

// React Query already skips refetchInterval while the tab is hidden. A visible
// tab nobody is using (a dashboard or presenter view left open on a laptop) is
// also treated as unfocused after this long, so it stops polling the server.
// Live state changes count as activity, so an untouched projector keeps
// following the show as long as the event is moving.
export const LIVE_IDLE_TIMEOUT = 2 * 60 * 60 * 1_000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"];

const idleMonitor = createIdleMonitor(LIVE_IDLE_TIMEOUT);

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

// Marks the user as active whenever any of `deps` changes.
export function useLiveActivity(deps: unknown[]) {
  useEffect(() => {
    idleMonitor.markActivity();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useLiveUpdatesPaused() {
  return useSyncExternalStore(
    idleMonitor.subscribe,
    idleMonitor.isIdle,
    () => false,
  );
}

// Replaces React Query's visibility listener: the app counts as focused while
// the tab is visible and not idle. Leaving idle or becoming visible refetches
// stale queries, as returning to a tab normally does.
export function pauseQueriesWhenIdle() {
  focusManager.setEventListener((setFocused) => {
    const isVisible = () => document.visibilityState !== "hidden";
    const update = () => {
      const focused = isVisible() && !idleMonitor.isIdle();
      if (focused !== focusManager.isFocused()) setFocused(focused);
    };
    const onVisibilityChange = () => {
      if (isVisible()) idleMonitor.markActivity();
      update();
    };
    const onActivity = () => idleMonitor.markActivity();

    document.addEventListener("visibilitychange", onVisibilityChange);
    ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, onActivity, {
        capture: true,
        passive: true,
      }),
    );
    const unsubscribe = idleMonitor.subscribe(update);
    idleMonitor.start();
    update();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ACTIVITY_EVENTS.forEach((type) =>
        window.removeEventListener(type, onActivity, { capture: true }),
      );
      unsubscribe();
      idleMonitor.stop();
    };
  });
}
