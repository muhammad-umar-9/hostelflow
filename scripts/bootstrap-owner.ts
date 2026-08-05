/**
 * One-time creation of the first owner account.
 *
 * There is no public registration route anywhere in this application, and there will not
 * be one: a hostel management system that lets a stranger sign themselves up is broken by
 * design. The first account is created here, on the server, by whoever has shell access.
 *
 *   docker compose exec app npm run bootstrap:owner
 *
 * The password is typed at the terminal rather than passed as an argument or an
 * environment variable, because both end up in shell history and process listings. Better
 * Auth hashes it with scrypt; this script never stores a plaintext password.
 *
 * Safe to re-run: if an owner already exists it refuses rather than creating a second one.
 * Further managers are invited from inside the application by the owner.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { MembershipRole } from "../lib/generated/prisma/enums";

const DATABASE_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_URL;
const AUTH_SECRET = process.env.AUTH_SECRET;

if (!DATABASE_URL || !APP_URL || !AUTH_SECRET) {
  console.error(
    "DATABASE_URL, APP_URL and AUTH_SECRET must all be set before bootstrapping an owner.",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const MIN_PASSWORD_LENGTH = 12;

/**
 * Reads a line without echoing it, so the password never appears on screen or in a
 * scrollback buffer.
 *
 * Readline keeps handling the line editing — backspace, Ctrl-C and Ctrl-D all behave
 * normally — and only its echo is suppressed, by replacing the method it uses to write
 * each keystroke back to the terminal. Reimplementing line editing by hand in raw mode
 * would be more code and worse behaviour in a script running while someone types a
 * password.
 */
async function readSecret(prompt: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });

  // Ask first, then mute: the prompt should be visible, the answer should not.
  const pending = rl.question(prompt);
  (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {};

  try {
    const answer = await pending;
    stdout.write("\n");
    return answer;
  } finally {
    rl.close();
  }
}

async function main() {
  const hostel = await prisma.hostel.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hostel) {
    console.error(
      "No hostel exists yet. Run `npm run db:seed` first so there is a hostel to own.",
    );
    process.exitCode = 1;
    return;
  }

  const existingOwner = await prisma.hostelMembership.findFirst({
    where: { hostelId: hostel.id, role: MembershipRole.OWNER, revokedAt: null },
    select: { user: { select: { email: true } } },
  });

  if (existingOwner) {
    console.error(
      `${hostel.name} already has an owner (${existingOwner.user.email}).\n` +
        "Invite further staff from inside the application rather than from this script.",
    );
    process.exitCode = 1;
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const name = (await rl.question("Owner full name: ")).trim();
  const email = (await rl.question("Owner email: ")).trim().toLowerCase();
  rl.close();

  if (name.length < 2) {
    console.error("Enter the owner's name.");
    process.exitCode = 1;
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Enter a valid email address.");
    process.exitCode = 1;
    return;
  }

  const password = await readSecret(`Password (at least ${MIN_PASSWORD_LENGTH} chars): `);
  const confirmation = await readSecret("Confirm password: ");

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }
  if (password !== confirmation) {
    console.error("The passwords do not match. Nothing was created.");
    process.exitCode = 1;
    return;
  }

  // Imported lazily so the prompts run before Better Auth reads its configuration.
  const { betterAuth } = await import("better-auth");
  const { prismaAdapter } = await import("better-auth/adapters/prisma");

  const auth = betterAuth({
    appName: "HostelFlow",
    baseURL: APP_URL,
    secret: AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    // Enabled only for this one call. The running application keeps sign-up disabled.
    emailAndPassword: { enabled: true, minPasswordLength: MIN_PASSWORD_LENGTH },
    telemetry: { enabled: false },
  });

  const created = await auth.api.signUpEmail({ body: { name, email, password } });

  if (!created?.user?.id) {
    console.error("The account could not be created.");
    process.exitCode = 1;
    return;
  }

  const userId = created.user.id;

  await prisma.$transaction(async (tx) => {
    await tx.hostelMembership.create({
      data: { hostelId: hostel.id, userId, role: MembershipRole.OWNER },
    });

    await tx.auditLog.create({
      data: {
        action: "user.created",
        entityType: "User",
        entityId: userId,
        hostelId: hostel.id,
        actorUserId: userId,
        summary: `First owner account created for ${hostel.name} by server bootstrap`,
        metadata: { email, role: MembershipRole.OWNER, via: "bootstrap-cli" },
      },
    });
  });

  console.log(`\nOwner created for ${hostel.name}.`);
  console.log(`  ${name} <${email}>`);
  console.log(`\nSign in at ${APP_URL}/login. This script will refuse to run again.`);
}

main()
  .catch((error) => {
    // Never print the error object itself: it can carry the request body, and the request
    // body carries the password.
    console.error(
      "Bootstrap failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
