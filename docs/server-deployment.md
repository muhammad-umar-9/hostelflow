# Server deployment

Deploying HostelFlow to an Ubuntu server with Docker Compose.

Nothing here has been run against the real server yet. Every command below is written to be
run by you, on your machine, deliberately.

## Requirements

- Ubuntu 22.04 or 24.04
- Docker Engine 24+ with the Compose plugin
- 2 GB RAM minimum, 4 GB comfortable; 20 GB disk
- A domain pointing at the server's public IP, ports 80 and 443 reachable

Certificate issuance needs port 80 open. If that is blocked, Caddy cannot obtain a
certificate and the site will not serve HTTPS.

## 1. Get the code

```bash
sudo mkdir -p /opt/hostelflow && sudo chown "$USER" /opt/hostelflow
git clone https://github.com/muhammad-umar-9/hostelflow.git /opt/hostelflow
cd /opt/hostelflow
```

Deploy from `main`, or from a release tag. Never from an unreviewed feature branch — see
`CLAUDE.md`.

## 2. Configure

```bash
cp .env.example .env
chmod 600 .env
```

Generate the secrets **on the server**. Do not reuse a value from a laptop, a chat window
or this document:

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 32   # MINIO_ROOT_PASSWORD
```

Edit `.env` and set:

| Variable              | Value                                            |
| --------------------- | ------------------------------------------------ |
| `APP_DOMAIN`          | `hostel.example.com` — no scheme                 |
| `APP_URL`             | `https://hostel.example.com` — no trailing slash |
| `NODE_ENV`            | `production`                                     |
| `AUTH_SECRET`         | first generated value                            |
| `POSTGRES_PASSWORD`   | second generated value                           |
| `DATABASE_URL`        | must contain the same password                   |
| `MINIO_ROOT_PASSWORD` | third generated value                            |

Check the password in `DATABASE_URL` matches `POSTGRES_PASSWORD`. A mismatch shows up as
the app failing its health check while Postgres looks perfectly healthy — an
easy twenty minutes to lose.

Confirm `DEMO_MODE=false`. The app refuses to start with `DEMO_MODE=true` and
`NODE_ENV=production`, but do not rely on that.

## 3. Build and start

```bash
docker compose build
docker compose up -d
docker compose ps
```

Every service should reach `healthy`. Postgres and MinIO show no published ports; that is
correct — only Caddy is reachable from outside.

The app's entrypoint applies migrations and creates the private bucket before the server
starts. Watch it:

```bash
docker compose logs --tail=200 app
```

Expect `applying database migrations`, `ensuring the private storage bucket exists`, then
`starting HostelFlow`. If migrations fail the container exits rather than serving against
an un-migrated database.

## 4. Seed the hostel

```bash
docker compose exec app npm run db:seed
```

Creates H-K Boys Hostel: 3 floors, 36 rooms, 126 beds, both room types and the configurable
charges. Idempotent — safe to re-run.

Do **not** run `db:seed:demo` on this server. It creates fictional residents and refuses to
run with `NODE_ENV=production`.

## 5. Create the owner

```bash
docker compose exec app npm run bootstrap:owner
```

Prompts for name, email and password (12+ characters, not echoed). It refuses to run once
an owner exists. There is no public registration route; this is the only way in.

## 6. Verify

```bash
curl -fsS https://hostel.example.com/api/health
```

Expect `{"status":"ok","database":"up","storage":"up"}`.

Then check by hand:

- `https://hostel.example.com` redirects to `/login` over HTTPS
- plain `http://` redirects to `https://`
- sign in as the owner
- `curl -I https://hostel.example.com` shows `strict-transport-security`
- these all refuse to connect from outside, which is the point:
  ```bash
  nc -zv hostel.example.com 5432    # PostgreSQL
  nc -zv hostel.example.com 9000    # MinIO
  ```

## 7. Confirm backups

```bash
docker compose logs backup | tail -20
docker compose exec backup ls -lh /backups/db /backups/objects
```

The backup service runs once at startup, so a dump should exist within a minute. Then read
[backup-and-restore.md](backup-and-restore.md) and **rehearse a restore before the hostel
depends on this**.

## Updating

```bash
cd /opt/hostelflow
git fetch origin
git checkout main && git pull --ff-only
docker compose build app
docker compose up -d app
docker compose logs --tail=100 app
```

Migrations apply automatically on start. Take a manual backup first — a single dump, not a
second copy of the loop:

```bash
docker compose exec backup sh -c '
  stamp=$(date -u +%Y%m%d-%H%M%S)
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --host=postgres --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" --no-owner --clean --if-exists \
    | gzip -9 > "/backups/db/manual-${stamp}.sql.gz"
  ls -lh "/backups/db/manual-${stamp}.sql.gz"
'
```

### Rollback limitations

Read this before you need it.

Rolling the **application** back is easy: check out the previous commit and rebuild.

Rolling a **migration** back is not. `prisma migrate deploy` only moves forward; there are
no down-migrations. If a migration is wrong the options are:

1. **Fix forward** — write a corrective migration. Almost always the right answer, and the
   only one that keeps data added since the bad migration.
2. **Restore from backup** — reverts the schema _and_ loses everything written since the
   backup.

So: never deploy a migration that has not been applied to a throwaway database first. CI
applies every migration to a fresh PostgreSQL on every push, which is the cheapest place
for a broken migration to be caught.

## Troubleshooting

**App unhealthy, Postgres healthy** — nearly always a `DATABASE_URL` password mismatch.
`docker compose logs app` shows an authentication failure.

**Caddy cannot get a certificate** — check DNS resolves to this server and port 80 is open.
`docker compose logs caddy` names the ACME failure.

**Storage initialization fails** — check `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` match
between the `app` and `minio` services; both read the same `.env`.

**Bootstrap says an owner already exists** — it did its job. Reset a forgotten password
from the database, or invite a second owner from inside the app.

## What is not automated

- No DNS changes are made for you.
- No deployment happens without you running these commands.
- No production data is touched by CI.

Deploying to the real server, and pointing a domain at it, is your decision and your
action.
