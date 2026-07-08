"use client";

import { getBrandingClient } from "~/lib/branding";
import { cn } from "~/lib/utils";

import Sticker from "~/components/Sticker";

import { useWorkspaceContext } from "./contexts/WorkspaceContext";

export default function ErrorPage() {
  const context = useWorkspaceContext();
  const branding = getBrandingClient(
    context?.currentEvent?.isPitchNight as boolean,
  );
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center pb-16 text-black">
      <Sticker name="facepalm" />
      <h1 className="pt-4 text-center text-2xl font-semibold">
        Something went wrong 🥲
      </h1>
      <p className="text-lg font-semibold italic">(hang with us!)</p>
      <button
        className={cn(
          "mt-4 rounded-lg px-4 py-3 font-semibold text-white shadow-xl",
          branding.isPitchNight
            ? "bg-green-800/80 hover:bg-green-900/80"
            : "bg-primary hover:bg-primary-dark",
        )}
        onClick={() => window.location.reload()}
      >
        Refresh page
      </button>
    </main>
  );
}
