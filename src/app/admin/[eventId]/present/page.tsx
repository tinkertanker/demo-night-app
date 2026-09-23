import { redirect } from "next/navigation";

import { getBranding } from "~/lib/branding.server";
import { api } from "~/trpc/server";

import Presentations from "./components/Presentations";

type Props = { params: { eventId: string } };

export async function generateMetadata({ params }: Props) {
  const currentEvent = await api.event.getLiveEvent(params.eventId);
  const branding = await getBranding();
  return { title: currentEvent?.name ?? branding.appName };
}

export default async function AdminPresentPage({ params }: Props) {
  const currentEvent = await api.event.getLiveEvent(params.eventId);
  if (!currentEvent) {
    redirect(`/admin/${params.eventId}`);
  }

  return (
    <main className="m-auto flex size-full max-w-xl flex-col text-black">
      <Presentations currentEvent={currentEvent} />
    </main>
  );
}
