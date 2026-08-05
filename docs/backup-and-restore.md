# Backup and restore

A backup nobody has restored is a hypothesis. The drill in section 3 is the part that
matters; run it before the hostel depends on this system, and again every few months.

## What is backed up

The `backup` service runs once at startup and then on an interval (daily by default), and
writes to the `backup-data` volume, which is separate from the database and object volumes.

| Path                                          | Contents                        |
| --------------------------------------------- | ------------------------------- |
| `/backups/db/hostelflow-<timestamp>.sql.gz`   | `pg_dump` of the whole database |
| `/backups/objects/objects-<timestamp>.tar.gz` | The MinIO data directory        |

Both are written to a `.partial` file and renamed only on success, so a truncated dump can
never be mistaken for a usable one during a restore.

Retention is `BACKUP_RETENTION_DAYS`, 14 by default. Older files are deleted on each run.

**Both files are needed.** The database holds the metadata and the object keys; MinIO holds
the actual CNIC images, payment proofs and PDFs. A database restored without its objects
gives you a system whose every document link is broken.

## 1. Checking backups are running

```bash
docker compose logs backup | tail -20
docker compose exec backup ls -lh /backups/db /backups/objects
```

Each successful run logs `run complete`. A failure logs `ERROR` and retries on the next
interval rather than exiting, so the service staying up is not by itself evidence that
backups are working — check the files.

### Taking one on demand

Before an upgrade or a risky change:

```bash
docker compose exec backup sh -c '
  stamp=$(date -u +%Y%m%d-%H%M%S)
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --host=postgres --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" --no-owner --clean --if-exists \
    | gzip -9 > "/backups/db/manual-${stamp}.sql.gz"
  tar -czf "/backups/objects/manual-${stamp}.tar.gz" -C /minio-source .
  ls -lh /backups/db/manual-${stamp}.sql.gz /backups/objects/manual-${stamp}.tar.gz
'
```

## 2. Getting backups off the machine

The `backup-data` volume is on the same disk as everything else. That protects against a
bad migration or a mistaken delete; it does **not** protect against disk failure, theft, or
the server being wiped.

Copy them off on a schedule:

```bash
# From another machine
rsync -avz --delete \
  user@your-server:/var/lib/docker/volumes/hostelflow_backup-data/_data/ \
  /secure/offsite/hostelflow/
```

These files contain every resident's CNIC images and complete financial history. **Encrypt
them if they leave the server**:

```bash
gpg --symmetric --cipher-algo AES256 hostelflow-20260805-023000.sql.gz
```

Store the passphrase somewhere other than the server being backed up.

## 3. The restore drill

Do this on a **test machine**, not production. It is the only way to know the backups work.

```bash
# 1. A separate copy of the stack
git clone https://github.com/muhammad-umar-9/hostelflow.git /tmp/restore-test
cd /tmp/restore-test
cp /path/to/.env .env          # edit APP_DOMAIN to something local
docker compose up -d postgres minio

# 2. Restore the database
gunzip -c hostelflow-20260805-023000.sql.gz \
  | docker compose exec -T postgres psql -U hostelflow -d hostelflow

# 3. Restore the objects
docker compose stop minio
docker compose run --rm -v /path/to/backups:/restore --entrypoint sh minio -c \
  'rm -rf /data/* && tar -xzf /restore/objects-20260805-023000.tar.gz -C /data'
docker compose start minio

# 4. Start the app and check
docker compose up -d
curl -fsS http://localhost:3000/api/health
```

Then verify by hand — a green health check only proves the services are up:

- sign in as the owner
- the resident count matches what you expect
- open a resident's CNIC image; it renders, meaning object storage came back too
- a receipt still shows the correct amounts
- the dashboard's occupancy figures look right

Write down how long it took. That number is your recovery time, and it is the honest answer
to "how long would we be down?"

## 4. Restoring production

Only after the drill above has succeeded at least once.

```bash
cd /opt/hostelflow

# 1. Stop the app so nothing writes during the restore. Keep postgres and minio up.
docker compose stop app backup

# 2. Take a backup of the CURRENT state first, however broken it looks.
#    Restoring over the only copy of the evidence is how a recoverable
#    incident becomes an unrecoverable one.
docker compose exec postgres pg_dump -U hostelflow hostelflow \
  | gzip > /tmp/pre-restore-$(date -u +%Y%m%d-%H%M%S).sql.gz

# 3. Restore the database
gunzip -c /path/to/hostelflow-<timestamp>.sql.gz \
  | docker compose exec -T postgres psql -U hostelflow -d hostelflow

# 4. Restore objects if they were lost too
docker compose stop minio
docker compose run --rm -v hostelflow_backup-data:/restore --entrypoint sh minio -c \
  'rm -rf /data/* && tar -xzf /restore/objects/objects-<timestamp>.tar.gz -C /data'
docker compose start minio

# 5. Bring the app back
docker compose up -d
docker compose logs --tail=100 app
curl -fsS https://$APP_DOMAIN/api/health
```

The dump uses `--clean --if-exists`, so it drops and recreates every object. Anything
written after the backup was taken is gone. Tell the owner what window was lost — residents
admitted in it will need re-entering, and the audit trail will not mention them.

## 5. What backups cannot fix

- **Data written since the last backup.** With daily backups, up to 24 hours. Shorten
  `BACKUP_INTERVAL_SECONDS` if that is too much; consider WAL archiving for
  point-in-time recovery if it is much too much.
- **A wrong migration already applied.** Restoring reverts the schema _and_ loses
  everything since. Usually the right answer is a corrective migration; see
  [server-deployment.md](server-deployment.md).
- **A leaked backup file.** Once copied, it cannot be unleaked. This is why they are
  encrypted in transit and at rest off-server.

## Schedule

| Task                            | Frequency                               |
| ------------------------------- | --------------------------------------- |
| Automatic backup                | Daily (`BACKUP_INTERVAL_SECONDS`)       |
| Check backup logs               | Weekly                                  |
| Copy off-server                 | Weekly                                  |
| **Full restore drill**          | Quarterly, and before any major upgrade |
| Review retention and disk usage | Quarterly                               |
