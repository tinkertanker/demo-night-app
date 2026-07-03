import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    database: false,
    kv: false,
  };

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error("Healthcheck database failure", error);
  }

  try {
    await kv.get("healthcheck");
    checks.kv = true;
  } catch (error) {
    console.error("Healthcheck KV failure", error);
  }

  const healthy = checks.database && checks.kv;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
