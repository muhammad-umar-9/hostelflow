#!/bin/bash
#
# Scheduled backup of PostgreSQL and the MinIO object store.
#
# Runs as its own long-lived container with a simple sleep loop rather than cron, so the
# schedule is visible in `docker compose logs backup` and a failure is loud instead of
# silently swallowed by cron's mail handling.
#
# What it produces, per run, under $BACKUP_DESTINATION:
#
#   db/hostelflow-YYYYmmdd-HHMMSS.sql.gz       pg_dump, compressed and verified
#   objects/objects-YYYYmmdd-HHMMSS.tar.gz     the MinIO data directory
#
# **bash, not sh, and pipefail is the point.** Under POSIX sh a pipeline reports the exit
# status of its LAST command, so `pg_dump | gzip` succeeded whenever gzip succeeded — even
# when pg_dump had died and written nothing. A truncated dump was then renamed from
# `.partial` to its final name, logged as complete, and retention deleted the older good
# backups. That is the worst possible failure for a backup system: it destroys the real
# backups while reporting success.
#
# Restoring is documented in docs/backup-and-restore.md. A backup nobody has restored is a
# hypothesis, not a backup: test it.

set -euo pipefail

BACKUP_DESTINATION="${BACKUP_DESTINATION:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
# Seconds between runs. 86400 = daily.
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

DB_DIR="${BACKUP_DESTINATION}/db"
OBJECT_DIR="${BACKUP_DESTINATION}/objects"

log() {
  echo "[backup] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"
}

# Removes leftovers from a previous interrupted run. Without this they accumulate
# forever: the retention globs below match only completed backups.
prune_partials() {
  find "$DB_DIR" "$OBJECT_DIR" -name '*.partial' -mmin +120 -delete 2>/dev/null || true
}

apply_retention() {
  log "removing backups older than ${BACKUP_RETENTION_DAYS} days"
  find "$DB_DIR" -name '*.sql.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete || true
  find "$OBJECT_DIR" -name '*.tar.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete || true
  prune_partials
}

dump_database() {
  local stamp="$1"
  local target="${DB_DIR}/hostelflow-${stamp}.sql.gz"

  log "dumping database to ${target}"

  # PGPASSWORD rather than a URL on the command line: process listings are readable by
  # anyone on the host. pipefail makes a pg_dump failure fail the whole pipeline.
  if ! PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    --host=postgres \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --no-owner \
    --clean \
    --if-exists \
    | gzip -9 > "${target}.partial"; then
    rm -f "${target}.partial"
    log "ERROR database dump failed"
    return 1
  fi

  # Independent proof the archive is complete and readable, rather than trusting exit
  # codes alone. A backup is only worth what a restore can read.
  if ! gzip -t "${target}.partial"; then
    rm -f "${target}.partial"
    log "ERROR dump failed its integrity check"
    return 1
  fi

  # A dump that restores nothing is still a "valid" gzip file, so check it actually
  # contains schema. 1 KB compressed is far below any real HostelFlow database.
  local size
  size="$(stat -c %s "${target}.partial")"
  if [ "$size" -lt 1024 ]; then
    rm -f "${target}.partial"
    log "ERROR dump is implausibly small (${size} bytes); refusing to keep it"
    return 1
  fi

  # Renamed only after every check passes, so a bad dump is never mistaken for a usable
  # one during a restore.
  mv "${target}.partial" "${target}"
  log "database dump complete ($(du -h "${target}" | cut -f1))"
}

archive_objects() {
  local stamp="$1"
  local target="${OBJECT_DIR}/objects-${stamp}.tar.gz"

  if [ ! -d /minio-source ]; then
    log "WARNING /minio-source is not mounted; object storage was not backed up"
    return 0
  fi

  log "archiving object storage to ${target}"

  # tar exits 1 for warnings and 2 for a fatal error. "file changed as we read it" is a
  # warning and happens routinely on a live volume — treating it as failure meant a
  # perfectly good archive aborted the run before retention ever executed, so backups
  # accumulated until the disk filled.
  local status=0
  tar -czf "${target}.partial" -C /minio-source . || status=$?

  if [ "$status" -gt 1 ]; then
    rm -f "${target}.partial"
    log "ERROR object archive failed (tar exit ${status})"
    return 1
  fi
  if [ "$status" -eq 1 ]; then
    log "NOTE tar reported files changing during the archive, which is expected on a live volume"
  fi

  if ! gzip -t "${target}.partial"; then
    rm -f "${target}.partial"
    log "ERROR object archive failed its integrity check"
    return 1
  fi

  mv "${target}.partial" "${target}"
  log "object archive complete ($(du -h "${target}" | cut -f1))"
}

run_backup() {
  local stamp
  stamp="$(date -u '+%Y%m%d-%H%M%S')"
  mkdir -p "$DB_DIR" "$OBJECT_DIR"

  local failed=0
  dump_database "$stamp" || failed=1
  archive_objects "$stamp" || failed=1

  # Retention runs whether or not this run succeeded. Skipping it on failure meant one
  # recurring warning could fill the volume, which then guarantees every future backup
  # fails too.
  apply_retention

  if [ "$failed" -ne 0 ]; then
    log "run finished WITH ERRORS"
    return 1
  fi

  log "run complete"
}

log "backup service started; interval ${BACKUP_INTERVAL_SECONDS}s, retention ${BACKUP_RETENTION_DAYS} days"
log "destination ${BACKUP_DESTINATION}"

# One immediately on start, so a fresh deployment has a restore point straight away and a
# misconfiguration surfaces now rather than at 02:30 tomorrow.
run_backup || log "initial backup failed; will retry on the next interval"

while true; do
  sleep "$BACKUP_INTERVAL_SECONDS"
  run_backup || log "backup failed; will retry on the next interval"
done
