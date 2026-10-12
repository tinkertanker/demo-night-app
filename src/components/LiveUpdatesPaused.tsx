"use client";

import { useLiveUpdatesPaused } from "~/lib/liveQuery";

// Any tap or key press resumes polling, so the notice only needs to say so.
export default function LiveUpdatesPaused() {
  const paused = useLiveUpdatesPaused();
  if (!paused) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur"
    >
      Live updates paused. Tap anywhere to resume.
    </div>
  );
}
