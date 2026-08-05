import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { serverEnv } from "./env";

/**
 * The one PrismaClient for the application.
 *
 * Prisma 7 no longer reads the connection string from the schema, so the URL arrives here
 * through the pg driver adapter. The adapter owns a connection pool, which is what makes
 * this safe to share across concurrent requests in a long-lived server process — creating
 * a client per request would exhaust PostgreSQL's connection limit under load.
 *
 * In development Next.js re-evaluates modules on every hot reload, so the client is
 * cached on `globalThis` to avoid leaking a pool per reload. Production gets a single
 * module instance and needs no such guard.
 */

function createPrismaClient(): PrismaClient {
  const env = serverEnv();

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    // Errors and warnings only. Queries are never logged: they carry CNIC values,
    // phone numbers and object keys.
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as typeof globalThis & {
  hostelflowPrisma?: PrismaClient;
};

function client(): PrismaClient {
  globalForPrisma.hostelflowPrisma ??= createPrismaClient();
  return globalForPrisma.hostelflowPrisma;
}

/**
 * Built on first use rather than at import, and reached through a proxy so call sites
 * still read `prisma.resident.findMany()`.
 *
 * That is not tidiness. `next build` imports every route module to collect its
 * configuration, so constructing the client at import time makes a production build
 * require a live DATABASE_URL and a real AUTH_SECRET — which the Dockerfile builder and
 * CI deliberately do not provide, and which a build machine has no business holding. It
 * also defeats the whole point of validating the environment lazily in env.ts.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client();
    const value = Reflect.get(instance, property, instance) as unknown;
    // Methods such as $transaction need their original `this`.
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

/**
 * The type of the client handed to a function running inside `prisma.$transaction`.
 * Helpers that must join their caller's transaction — audit writes, ledger entries —
 * accept this so their row commits or rolls back with the operation it describes.
 *
 * Derived from `$transaction` itself rather than hand-written as an `Omit`, so it stays
 * correct when Prisma changes which methods the interactive client exposes.
 */
export type TransactionClient = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

/** Either the shared client or an open transaction. */
export type DbClient = PrismaClient | TransactionClient;
