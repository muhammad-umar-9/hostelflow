import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { storageReachable } from "@/lib/server/storage";

/**
 * Health check for the compose health probe and for post-deployment verification.
 *
 * Unauthenticated on purpose — a health probe has no session — so it reports only
 * reachability. No version, no hostname, no configuration, no counts. A health endpoint
 * that enumerates your stack is free reconnaissance.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Reachability of the database.
 *
 * Wrapped in try/catch rather than `.catch()` on the promise. `prisma` is a lazy proxy, so
 * a misconfigured container throws from the property access itself — synchronously, before
 * any promise exists — and `.catch()` never runs. The result was a bare 500 in exactly the
 * situation this endpoint is meant to diagnose, instead of a 503 naming the failing part.
 */
async function databaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [database, storage] = await Promise.all([
    databaseReachable(),
    storageReachable(),
  ]);

  const healthy = database && storage;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database: database ? "up" : "down",
      storage: storage ? "up" : "down",
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
