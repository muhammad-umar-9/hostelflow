# HostelFlow production image.
#
# Multi-stage so the runtime image carries no source, no build toolchain and no dev
# dependencies. The final stage runs as an unprivileged user and contains only the Next.js
# standalone output, the generated Prisma client, the migrations and the small set of
# scripts an operator runs (migrate, seed, bootstrap an owner, initialize the bucket).

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

# Standalone output: server.js plus only the node_modules it actually needs.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Migrations, seeds and operator scripts. The Prisma CLI and tsx come from the full
# dependency tree, which standalone output does not include.
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/lib/generated ./lib/generated
COPY --from=builder --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=node:node /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder --chown=node:node /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder --chown=node:node /app/package.json ./package.json

COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
