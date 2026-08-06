import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 reads its configuration from this file rather than from package.json.
 *
 * `DATABASE_URL` is only required by commands that talk to a database — `migrate deploy`,
 * `db execute`, `studio`. Schema-only commands — `validate`, `generate` and
 * `migrate diff --from-empty` — need no database, which is how migrations are produced on
 * a machine that has no PostgreSQL.
 *
 * The datasource is therefore attached only when the variable exists. Prisma's `env()`
 * helper resolves eagerly and throws `PrismaConfigEnvError` when the variable is missing,
 * which made loading this file fail everywhere `DATABASE_URL` was unset. Since
 * `postinstall` runs `prisma generate`, that broke `npm ci` itself — on CI, in the Docker
 * build, and on any fresh clone. It went unnoticed locally only because an unrelated
 * `DATABASE_URL` happened to be set in the developer's shell.
 *
 * Omitting the key instead means schema-only commands work anywhere, and a command that
 * genuinely needs a connection fails with Prisma's own message about a missing datasource
 * rather than at config-load time.
 */
/**
 * A syntactically valid URL that cannot resolve, used when DATABASE_URL is absent.
 *
 * Omitting the datasource entirely was the first attempt, and it broke `migrate diff`
 * silently: the command exited zero having emitted no SQL at all, which is how an empty
 * migration file nearly got committed. A placeholder keeps schema-only commands working,
 * and any command that genuinely needs a connection fails with a resolution error naming
 * this host, which says what is wrong.
 */
const UNSET_PLACEHOLDER =
  "postgresql://unset:unset@database-url-is-not-set.invalid:5432/unset";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: { url: databaseUrl ?? UNSET_PLACEHOLDER },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
