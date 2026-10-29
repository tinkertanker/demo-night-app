import HomePage from "../components/HomePage";
import Workspaces from "../components/Workspaces";

import { getBranding } from "~/lib/branding.server";
import { normalizeJoinCode } from "~/lib/joinCode";
import { api } from "~/trpc/server";

// Attendees join a live event at /<join code>. The segment is named `eventId`
// only because Next.js requires sibling dynamic routes ((demoist)/[eventId],
// (submission)/[eventId]) to share a slug name; its value is a join code.
type Props = { params: { eventId: string } };

// The segment arrives URL-encoded (e.g. "%20qad2%20"); look up and show what was typed.
function typedCode(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function generateMetadata({ params }: Props) {
  const liveEvent = await api.event.getLiveByCode(typedCode(params.eventId));
  const branding = await getBranding();
  return {
    title: liveEvent?.name ?? branding.appName,
    icons: [
      {
        rel: "icon",
        url: "/favicon.ico",
      },
    ],
  };
}

export default async function JoinedEventPage({ params }: Props) {
  const liveEvent = await api.event.getLiveByCode(typedCode(params.eventId));
  if (!liveEvent) {
    return (
      <HomePage invalidCode={normalizeJoinCode(typedCode(params.eventId))} />
    );
  }
  return (
    <main className="m-auto flex size-full max-w-xl flex-col text-black">
      <Workspaces currentEvent={liveEvent} />
    </main>
  );
}
