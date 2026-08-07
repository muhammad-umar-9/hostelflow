/**
 * Creates the end-to-end owner account, idempotently.
 *
 * Separate from `bootstrap:owner` rather than a flag on it, because that script prompts on
 * a terminal and is the documented way a real hostel gets its first account. Adding a
 * non-interactive path to it would put "create an owner from environment variables" one
 * typo away from the production runbook. This one refuses to run against anything but a
 * database the caller has explicitly nominated for testing.
 */
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { MembershipRole } from "@/lib/generated/prisma/enums";

const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;
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
  const { auth } = await import("@/lib/server/auth");

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

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
      await auth().api.signUpEmail({
        body: { name: "E2E Owner", email: email!, password: password! },
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
