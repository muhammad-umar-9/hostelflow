/**
 * Creates the end-to-end owner account, idempotently.
 *
 * Separate from `bootstrap:owner` rather than a flag on it, because that script prompts on
 * a terminal and is the documented way a real hostel gets its first account. Adding a
 * non-interactive path to it would put "create an owner from environment variables" one
 * typo away from the production runbook. This one refuses to run against anything but a
 * database the caller has explicitly nominated for testing.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { MembershipRole } from "../lib/generated/prisma/enums";
import { sharedAuthOptions } from "../lib/auth-options";

const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;
const ownerName = process.env.E2E_OWNER_NAME ?? "E2E Owner";
const databaseUrl = process.env.DATABASE_URL;

if (!email || !password || !databaseUrl) {
  throw new Error(
    "e2e-owner requires E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD and DATABASE_URL.",
  );
}

// A test fixture must never be able to touch a live hostel. The suite's database is named
// by the harness and always carries a test marker; refuse anything else outright.
if (!/_test\b|_e2e\b|hostelflow_test/i.test(databaseUrl)) {
  throw new Error(
    "Refusing to run: DATABASE_URL does not name a test database. " +
      "Expected the name to contain `_test` or `_e2e`.",
  );
}

async function main() {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  // A local instance rather than lib/server/auth, which is marked `server-only`: Next
  // aliases that package away, a tsx script cannot, so importing it here throws
  // "This module cannot be imported from a Client Component module" — which is what CI
  // reported. The settings come from the same shared source the application uses, so the
  // password this creates is hashed exactly the way the application will verify it.
  const auth = betterAuth(
    sharedAuthOptions({
      baseURL: process.env.APP_URL ?? "http://127.0.0.1:3100",
      secret: process.env.AUTH_SECRET ?? "e2e-secret-not-used-anywhere-else-0123456789",
      database: prismaAdapter(prisma, { provider: "postgresql" }),
    }),
  );

  try {
    const hostel = await prisma.hostel.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!hostel) throw new Error("No hostel found — run `npm run db:seed` first.");

    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      // Better Auth owns password hashing; creating the row directly would store a
      // password this application could never verify.
      await auth.api.signUpEmail({
        body: { name: ownerName, email: email!, password: password! },
      });
      user = await prisma.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });
    }

    // The unique is (hostelId, activeUserId) — the mirror column that stays NULL once a
    // membership is revoked, so revoked history does not collide.
    await prisma.hostelMembership.upsert({
      where: { hostelId_activeUserId: { hostelId: hostel.id, activeUserId: user.id } },
      create: {
        hostelId: hostel.id,
        userId: user.id,
        role: MembershipRole.OWNER,
        activeUserId: user.id,
      },
      // A previous run may have revoked it; the suite needs it live.
      update: { role: MembershipRole.OWNER, revokedAt: null, activeUserId: user.id },
    });

    console.log(`e2e owner ready: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
