import { redirect } from "next/navigation";

import { api } from "~/trpc/server";

// The presenter view now lives at /admin/[eventId]/present. Keep old bookmarks
// working when there's only one live event to present.
export default async function LegacyPresentPage() {
  const liveEvents = await api.event.getLive();
  if (liveEvents.length === 1) {
    redirect(`/admin/${liveEvents[0]!.id}/present`);
  }
  redirect("/admin");
}
