import HallOfFamePage from "../hall-of-fame/page";

import { getBranding } from "~/lib/branding.server";
import { api } from "~/trpc/server";

import Workspaces from "./components/Workspaces";

export async function generateMetadata() {
  const currentEvent = await api.event.getCurrentActive();
  const branding = await getBranding();
  return {
    title: currentEvent?.name ?? branding.appName,
    robots: {
      index: true,
      follow: true,
    },
    icons: [
      {
        rel: "icon",
        url: branding.isPitchNight ? "/favicon-pitch.ico" : "/favicon.ico",
      },
    ],
  };
}

export default async function AttendeePage() {
  const currentEvent = await api.event.getCurrentActive();
  if (!currentEvent) return <HallOfFamePage />;
  return (
    <main className="m-auto flex size-full max-w-xl flex-col text-black">
      <Workspaces currentEvent={currentEvent} />
    </main>
  );
}
