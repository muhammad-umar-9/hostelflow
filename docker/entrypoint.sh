#!/bin/sh
#
# Container entrypoint.
#
# Applies pending migrations and ensures the private bucket exists, then starts the
# server. Both steps are idempotent and both must succeed: starting an app against an
# un-migrated database produces confusing runtime errors instead of one clear failure.
#
# `migrate deploy` only applies migrations that already exist. It never generates one and
# never resets anything, which is what makes it safe to run automatically on every boot.

set -eu

echo "[entrypoint] applying database migrations"
if ! npx prisma migrate deploy; then
  echo "[entrypoint] migrations failed; refusing to start" >&2
  exit 1
fi

echo "[entrypoint] ensuring the private storage bucket exists"
if ! npx tsx scripts/init-storage.ts; then
  echo "[entrypoint] storage initialization failed; refusing to start" >&2
  exit 1
fi

echo "[entrypoint] starting HostelFlow"
exec "$@"
