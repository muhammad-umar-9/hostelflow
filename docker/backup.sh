#!/bin/sh
#
# Scheduled backup of PostgreSQL and the MinIO object store.
#
# Runs as its own long-lived container with a simple sleep loop rather than cron, so the
# schedule is visible in `docker compose logs backup` and a failure is loud instead of
# silently swallowed by cron's mail handling.
#
# What it produces, per run, under $BACKUP_DESTINATION:
#
#   db/hostelflow-YYYYmmdd-HHMMSS.sql.gz       pg_dump, compressed
#   objects/objects-YYYYmmdd-HHMMSS.tar.gz     the MinIO data directory
#
# Restoring is documented in docs/backup-and-restore.md. A backup nobody has restored is
# a hypothesis, not a backup: test it.

set -eu

BACKUP_DESTINATION="${BACKUP_DESTINATION:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
# Seconds between runs. 86400 = daily.
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

DB_DIR="${BACKUP_DESTINATION}/db"
OBJECT_DIR="${BACKUP_DESTINATION}/objects"

log() {
  echo "[backup] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"
}

run_backup() {
  stamp="$(date -u '+%Y%m%d-%H%M%S')"
  mkdir -p "$DB_DIR" "$OBJECT_DIR"

  db_file="${DB_DIR}/hostelflow-${stamp}.sql.gz"
  log "dumping database to ${db_file}"

  # PGPASSWORD rather than a URL on the command line: process listings are readable by
  # anyone on the host.
  if PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    --host=postgres \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --no-owner \
    --clean \
    --if-exists \
    | gzip -9 > "${db_file}.partial"; then
    # Renamed only after a clean finish, so a truncated dump is never mistaken for a
    # usable one during a restore.
    mv "${db_file}.partial" "${db_file}"
    log "database dump complete ($(du -h "${db_file}" | cut -f1))"
  else
    rm -f "${db_file}.partial"
    log "ERROR database dump failed"
    return 1
  fi

  if [ -d /minio-source ]; then
    object_file="${OBJECT_DIR}/objects-${stamp}.tar.gz"
    log "archiving object storage to ${object_file}"

    if tar -czf "${object_file}.partial" -C /minio-source . 2>/dev/null; then
      mv "${object_file}.partial" "${object_file}"
      log "object archive complete ($(du -h "${object_file}" | cut -f1))"
    else
      rm -f "${object_file}.partial"
      log "ERROR object archive failed"
      return 1
    fi
  else
    log "WARNING /minio-source is not mounted; object storage was not backed up"
  fi

  log "removing backups older than ${BACKUP_RETENTION_DAYS} days"
  find "$DB_DIR" -name '*.sql.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete
  find "$OBJECT_DIR" -name '*.tar.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete

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
