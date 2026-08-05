import path from "node:path";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 reads its configuration from this file rather than from package.json.
 *
 * `DATABASE_URL` is only required by commands that talk to a database (`migrate deploy`,
 * `db execute`, `studio`). Schema-only commands — `validate`, `generate` and
 * `migrate diff --from-empty` — work without it, which is how migrations are produced on
 * a machine that has no PostgreSQL.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
