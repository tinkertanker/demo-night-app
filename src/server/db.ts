import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "~/env";

const createPrismaClient = (adapter: PrismaNeon | PrismaPg) =>
  new PrismaClient({
    adapter,
    // Voting transactions queue on a per-event advisory lock, so allow for
    // waiting behind a burst of votes
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// On Cloudflare Workers a socket can't outlive the request that opened it, so
// each request gets its own client. It uses Neon's WebSocket driver: the pg
// driver's small TCP writes stall for 40-150ms per query on Workers sockets.
// Elsewhere (local dev, scripts) one pg client is shared.
const workerRequestContext = (): object | undefined => {
  try {
    return getCloudflareContext().ctx;
  } catch {
    return undefined;
  }
};

const requestClients = new WeakMap<object, PrismaClient>();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClient(): PrismaClient {
  const ctx = workerRequestContext();
  if (ctx) {
    let client = requestClients.get(ctx);
    if (!client) {
      client = createPrismaClient(
        new PrismaNeon({ connectionString: env.DATABASE_URL }),
      );
      requestClients.set(ctx, client);
    }
    return client;
  }

  globalForPrisma.prisma ??= createPrismaClient(
    new PrismaPg({ connectionString: env.DATABASE_URL }),
  );
  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
