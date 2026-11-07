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
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !constantTimeEqual(header, `Bearer ${secret}`)) {
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

function constantTimeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}
