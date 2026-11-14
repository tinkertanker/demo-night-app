import { NextResponse } from "next/server";

import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    database: false,
  };
  const timings: Record<string, number> = {};

  try {
    let start = Date.now();
    await db.$queryRaw`SELECT 1`;
    timings.firstQueryMs = Date.now() - start;
    start = Date.now();
    await db.$queryRaw`SELECT 1`;
    timings.queryMs = Date.now() - start;
    checks.database = true;
  } catch (error) {
    console.error("Healthcheck database failure", error);
  }

  const healthy = checks.database;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      checks,
      timings,
    },
    { status: healthy ? 200 : 503 },
  );
}
