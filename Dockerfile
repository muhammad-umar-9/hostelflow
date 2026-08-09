# HostelFlow production image.
#
# Multi-stage so the runtime image carries no source and no build toolchain. The final
# stage runs as an unprivileged user.
#
# A note on node_modules, because the obvious optimization here is a trap. Next.js
# standalone output contains only what the *server* needs, and it bundles most packages
# into the compiled route chunks rather than leaving them in node_modules. The operator
# scripts — migrate, seed, bootstrap an owner, initialize the bucket — are not part of that
# build. They run under tsx and resolve their imports from node_modules at run time, so
# they need minio, better-auth, @prisma/adapter-pg, the Prisma CLI, and tsx's own esbuild
# binary, none of which standalone provides.
#
# Hand-picking those directories is how this image was first written, and it produced a
# container that exited on boot because tsx could not find esbuild. So the runtime stage
# installs the real production dependency tree and lets standalone overlay it. The image is
# larger; it also starts.

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
# ---------------------------------------------------------------------------
WORKDIR /app

# openssl is required by Prisma's query engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Only the manifests, so this layer is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# `npm ci` installs exactly the locked versions. postinstall runs prisma generate, which
# needs the schema — hence copying prisma/ above.
RUN npm ci

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS prod-deps
# ---------------------------------------------------------------------------
# The dependency tree the running container actually needs: production dependencies only,
# but complete. tsx lives in `dependencies` precisely because this stage must include it.
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
# ---------------------------------------------------------------------------
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The build must not depend on production secrets. Server configuration is validated
# lazily at request time precisely so this stage needs no database and no auth secret.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run db:generate && npm run build

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
# ---------------------------------------------------------------------------
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# node:22 already provides a `node` user (uid 1000). Reusing it avoids running as root.
RUN mkdir -p /app && chown -R node:node /app

# 1. The production dependency tree, for the operator scripts.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# 2. Standalone output on top: server.js plus the modules Next traced for it. Where the
#    two overlap the versions are identical, since both come from the same lockfile.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# 3. Migrations, seeds, operator scripts and the generated Prisma client.
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /app/scripts ./scripts
# The whole of lib/, not only lib/generated.
#
# scripts/bootstrap-owner.ts — the ONLY way a fresh deployment gets its first account,
# since sign-up is disabled server-side — imports ../lib/auth-options. Copying just the
# generated client made that import ERR_MODULE_NOT_FOUND inside the image, so the very
# first owner could never be created and there is no other route in. Copying the directory
# means the next shared module added under lib/ does not silently repeat it.
COPY --from=builder --chown=node:node /app/lib ./lib
COPY --from=builder --chown=node:node /app/package.json ./package.json

COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Fails the build rather than the deployment if the runtime tree is ever incomplete again.
# Each of these is imported by a script the entrypoint runs before the server starts.
RUN node -e "require.resolve('minio'); require.resolve('@prisma/adapter-pg'); require.resolve('better-auth'); require.resolve('esbuild');" \
  && node_modules/.bin/tsx --version > /dev/null \
  && node_modules/.bin/prisma --version > /dev/null \
  && echo "runtime dependency check passed"

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
