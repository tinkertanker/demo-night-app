export enum EventPhase {
  Pre,
  Demos,
  Voting,
  Results,
  Recap,
}

export const allPhases = [
  EventPhase.Pre,
  EventPhase.Demos,
  EventPhase.Voting,
  EventPhase.Results,
  EventPhase.Recap,
];

export function displayName(
  phase: EventPhase,
  isPitchNight = false,
  financial = isPitchNight,
): string {
  switch (phase) {
    case EventPhase.Pre:
      return isPitchNight ? "Pre-Pitches" : "Pre-Demos";
    case EventPhase.Demos:
      return isPitchNight ? "Pitches" : "Demos";
    case EventPhase.Voting:
      return financial ? "Investing" : "Voting";
    case EventPhase.Results:
      return "Results";
    case EventPhase.Recap:
      return "Recap";
  }
}

// A live event as attendees and presenters see it. Several events can be live at
// once; attendees pick theirs with its join code.
export type CurrentEvent = {
  id: string;
  name: string;
  phase: EventPhase;
  currentDemoId: string | null;
  currentAwardId: string | null;
  isPitchNight: boolean;
  // Overlaid from the Event row by the event router; not stored in LiveEvent.
  joinCode?: string | null;
};
