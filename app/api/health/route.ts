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

export async function GET() {
  const [database, storage] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
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
