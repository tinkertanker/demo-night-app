import Link from "next/link";

import { getBranding } from "~/lib/branding.server";

import { LogoConfetti } from "~/components/Confetti";
import Sticker from "~/components/Sticker";

import JoinEventForm from "./JoinEventForm";

const SOURCE_URL = "https://github.com/tinkertanker/demo-night-app";
const CREDIT_URL = "https://github.com/the-ai-collective/demo-night-app";
const TINKERCADEMY_URL = "https://www.tinkercademy.com";

// Also shown by /[code] when the code doesn't match a live event.
export default async function HomePage({
  invalidCode,
}: {
  invalidCode?: string;
}) {
  const branding = await getBranding();

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center pb-16 text-black">
      <Sticker name="yay" />
      <Sticker name="thumbsup" size={36} className="hidden" priority={false} />
      <h1 className="pt-4 text-center text-2xl font-semibold">
        {branding.appName} App
      </h1>
      <div className="mt-6 flex w-full flex-col items-center gap-3 px-4">
        <JoinEventForm key={invalidCode} invalidCode={invalidCode} />
      </div>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href={TINKERCADEMY_URL}
          className="z-10 rounded-lg bg-primary px-4 py-3 font-semibold text-white shadow-sm transition-all hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          Tinkercademy
        </Link>
        <p className="z-10 text-sm font-semibold text-gray-600">
          <Link
            href={SOURCE_URL}
            className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900 hover:decoration-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Source
          </Link>{" "}
          /{" "}
          <Link
            href={CREDIT_URL}
            className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900 hover:decoration-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Credit: AI Collective
          </Link>
        </p>
      </div>
      <div className="z-3 pointer-events-none fixed inset-0">
        <LogoConfetti />
      </div>
    </main>
  );
}
