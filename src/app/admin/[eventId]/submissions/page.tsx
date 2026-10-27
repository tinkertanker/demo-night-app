import { redirect } from "next/navigation";

import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";

import SubmissionsDashboard from "./components/SubmissionsDashboard";

export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: { eventId: string };
  searchParams: { secret?: string };
}) {
  const event = await db.event.findUnique({
    where: { id: params.eventId },
  });

  if (!event) {
    return redirect("/404");
  }

  const auth = await getServerAuthSession();
  const email = auth?.user.email?.toLowerCase();
  const isAdmin = !!(
    email && (await db.admin.findUnique({ where: { email } }))
  );

  if (!isAdmin && searchParams.secret !== event.secret) {
    return redirect("/404?type=invalid-secret");
  }

  return (
    <main className="flex h-dvh w-full flex-col p-4">
      <SubmissionsDashboard event={event} isAdmin={isAdmin} />
    </main>
  );
}
