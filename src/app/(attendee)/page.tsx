import { getBranding } from "~/lib/branding.server";
import { api } from "~/trpc/server";

import Workspaces from "./components/Workspaces";
import { LinkButton } from "~/components/Button";
import { LogoConfetti } from "~/components/Confetti";
import Sticker from "~/components/Sticker";

const GITHUB_URL = "https://github.com/tinkertanker/demo-night-app";
const TINKERCADEMY_URL = "https://www.tinkercademy.com";

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
  if (!currentEvent) return <HomePage />;
  return (
    <main className="m-auto flex size-full max-w-xl flex-col text-black">
      <Workspaces currentEvent={currentEvent} />
    </main>
  );
}

async function HomePage() {
  const branding = await getBranding();

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center pb-16 text-black">
      <Sticker name="yay" />
      <Sticker name="thumbsup" size={36} className="hidden" />
      <h1 className="pt-4 text-center text-2xl font-semibold">
        {branding.appName} App
      </h1>
      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <LinkButton href={GITHUB_URL}>GitHub</LinkButton>
        <LinkButton href={TINKERCADEMY_URL}>Tinkercademy</LinkButton>
      </div>
      <div className="z-3 pointer-events-none fixed inset-0">
        <LogoConfetti />
      </div>
    </main>
  );
}
