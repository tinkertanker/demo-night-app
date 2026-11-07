import { NextResponse } from "next/server";

import { db, releaseRequestDb } from "~/server/db";
import { scrubExpiredEmails } from "~/server/emailScrub";

import { env } from "~/env";

export const dynamic = "force-dynamic";

// Called by the Worker's cron trigger (worker.ts) through the app's own fetch
// handler, so the request never leaves the Worker. NEXTAUTH_SECRET is reused as
// the shared secret rather than adding another production secret.
export async function POST(req: Request) {
  const secret = env.NEXTAUTH_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const scrubbed = await scrubExpiredEmails(db);
    // Counts only: never log the emails themselves.
    console.log(JSON.stringify({ emailScrub: scrubbed }));
    return NextResponse.json(scrubbed);
  } finally {
    releaseRequestDb();
  }
}
