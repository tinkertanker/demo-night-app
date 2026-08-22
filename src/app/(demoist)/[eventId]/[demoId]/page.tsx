import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { isPastEventDay } from "~/lib/singaporeDate";
import { EventPhase } from "~/lib/types/currentEvent";
import { api } from "~/trpc/server";

import DemoRecap from "./components/DemoRecap";
import { UpdateDemoPage } from "./components/UpdateDemo";
import EventHeader from "~/components/EventHeader";

export async function generateMetadata({
  params: { eventId, demoId },
  searchParams: { secret },
}: {
  params: { eventId: string; demoId: string };
  searchParams: { secret: string };
}): Promise<Metadata> {
  if (!secret) {
    return {
      title: "Demo Page",
    };
  }

  try {
    const [event, demo] = await Promise.all([
      api.event.get(eventId),
      api.demo.get({ id: demoId, secret }),
    ]);

    if (!event || !demo) {
      return {
        title: "Demo Page",
      };
    }

    return {
      title: `${demo.name} - ${event.name}`,
      icons: [
        {
          rel: "icon",
          url: "/favicon.ico",
        },
      ],
    };
  } catch {
    return {
      title: "Demo Page",
    };
  }
}

export default async function DemoistPage({
  params: { eventId, demoId },
  searchParams: { secret },
}: {
  params: { eventId: string; demoId: string };
  searchParams: { secret: string };
}) {
  if (!secret) {
    redirect("/404?type=invalid-secret");
  }

  const [currentEvent, event, demo] = await Promise.all([
    api.event.getCurrent(),
    api.event.get(eventId),
    api.demo.get({ id: demoId, secret }),
  ]);

  if (!event || !demo) {
    redirect("/404");
  }

  let showRecap = true;

  // Only show the recap page if the demo has already happened
  if (!currentEvent) {
    if (!isPastEventDay(event.date)) {
      showRecap = false;
    }
  } else if (currentEvent.phase === EventPhase.Pre) {
    showRecap = false;
  } else if (currentEvent.phase === EventPhase.Demos) {
    showRecap = false;
  }

  if (!showRecap) {
    return (
      <main className="m-auto flex size-full max-w-xl flex-col text-black">
        <EventHeader event={event} />
        <UpdateDemoPage demo={demo} event={event} secret={secret} />
      </main>
    );
  }

  return (
    <main className="m-auto flex size-full max-w-xl flex-col text-black">
      <EventHeader event={event} demoName={demo.name} />
      <DemoRecap demo={demo} event={event} />
    </main>
  );
}
