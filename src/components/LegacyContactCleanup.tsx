"use client";

import { useEffect } from "react";

// Clean all events on any visit, not only the currently opened submission.
// Offline devices/old open tabs can only be cleaned when they load new code.
export default function LegacyContactCleanup() {
  useEffect(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          !key ||
          !(
            key.startsWith("submissionDraft:") ||
            key.startsWith("attendee:") ||
            key === "attendee"
          )
        )
          continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const value: unknown = JSON.parse(raw);
          if (value && typeof value === "object" && "email" in value) {
            delete value.email;
            localStorage.setItem(key, JSON.stringify(value));
          }
        } catch {
          // Malformed drafts cannot be restored; do not leave a contact behind.
          localStorage.removeItem(key);
          i--;
        }
      }
    } catch {
      // Storage may be unavailable. Never block the app.
    }
  }, []);
  return null;
}
