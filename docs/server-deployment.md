# Server deployment

Deploying HostelFlow with Docker Compose onto a server that is **already running other
projects**, using a Cloudflare tunnel so nothing contends for ports 80 and 443.

Nothing here has been run against the real server yet. Every command is written to be run
by you, deliberately.

## The topology, and why

The pilot server already hosts two live projects. Ports 80 and 443 belong to another
project's nginx container, and a second Postgres is already running. So HostelFlow:

- **publishes no ports at all** — not 80, not 443, not 5432, not 9000;
- reaches the internet through **cloudflared**, which dials out to Cloudflare and receives
  traffic over that connection;
- keeps its database and object storage on a compose network marked `internal`, unreachable
  from the host, from the other projects, and from the internet.

The consequence worth stating: **nothing on this stack can be port-scanned**, and bringing
it up cannot disturb a site that is already serving.

A dedicated server is simpler — Caddy owns 80/443 and terminates TLS itself. That
configuration still exists, behind the `standalone` profile.

## Requirements

- Ubuntu 22.04 or newer, Docker Engine 24+ with the Compose plugin
- ~1 GB RAM and a few GB of disk beyond what the machine already uses
- A Cloudflare account with your domain added as a zone

## 1. Register the domain

The GitHub Student Developer Pack includes a free year from **name.com** and from
**.tech**. Either is fine; a subdomain of a domain you already own works equally well and
costs nothing.

Then add the domain to Cloudflare (Add a site → follow the nameserver instructions at your
registrar). The tunnel needs the domain to be a Cloudflare zone; it does not need any A or
CNAME record pointing at your server, and it never will.

## 2. Get the code

```bash
sudo mkdir -p /opt/hostelflow && sudo chown "$USER" /opt/hostelflow
git clone https://github.com/muhammad-umar-9/hostelflow.git /opt/hostelflow
cd /opt/hostelflow
```

Deploy from `main`, or from a release tag. Never from an unreviewed branch — see
`CLAUDE.md`.

## 3. Create the tunnel

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel**, choose
**Cloudflared**, and name it `hostelflow`.

Under **Public Hostnames**, add one:

| Field        | Value                            |
| ------------ | -------------------------------- |
| Subdomain    | `hostel` (or whatever you chose) |
| Domain       | your domain                      |
| Service type | `HTTP`                           |
| URL          | `app:3000`                       |

`app:3000` is the service name on HostelFlow's own compose network — cloudflared resolves
it there, and it is not reachable from anywhere else.

Copy the tunnel token from the install command Cloudflare shows. It is a credential:
anything holding it can serve traffic for that hostname.

### Turn on Always Use HTTPS — this step is not optional

**SSL/TLS → Edge Certificates → Always Use HTTPS: On.**

Caddy used to issue the HTTP→HTTPS redirect. Under the tunnel it is not running, and
nothing in the application redirects either, so without this setting the login page is
reachable over plain `http://`. The session cookie is issued `Secure`; a browser silently
discards it on an insecure origin. The symptom is the worst kind: sign-in appears to work,
the page returns to the login screen, and nothing appears in any log — because from the
server's point of view nothing went wrong.

While you are there, set **SSL/TLS → Overview → Full**. `Flexible` would have Cloudflare
talk plain HTTP to the tunnel and tell the browser the connection is secure.

## 4. Configure

```bash
cp .env.example .env
chmod 600 .env
```

Generate the secrets **on the server**:

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 32   # MINIO_ROOT_PASSWORD
```

Set in `.env`:

| Variable                  | Value                           |
| ------------------------- | ------------------------------- |
| `APP_DOMAIN`              | `hostel.yourdomain.com`         |
| `APP_URL`                 | `https://hostel.yourdomain.com` |
| `NODE_ENV`                | `production`                    |
| `AUTH_SECRET`             | first generated value           |
| `POSTGRES_PASSWORD`       | second generated value          |
| `DATABASE_URL`            | must contain the same password  |
| `MINIO_ROOT_PASSWORD`     | third generated value           |
| `CLOUDFLARE_TUNNEL_TOKEN` | the token from step 3           |
| `COMPOSE_PROFILES`        | `tunnel`                        |
| `TRUSTED_PROXY`           | `cloudflare`                    |

`APP_URL` must be the `https://` address even though the app itself speaks plain HTTP to
cloudflared. Cloudflare terminates TLS; session cookies are issued `Secure`, and a browser
will not send those back to an `http://` origin.

Check the password inside `DATABASE_URL` matches `POSTGRES_PASSWORD`. A mismatch shows up
as the app failing its health check while Postgres looks perfectly healthy.

## 5. Build and start

```bash
docker compose build
docker compose up -d          # .env sets COMPOSE_PROFILES=tunnel
docker compose ps
```

If you ever run this without a profile selected, the stack comes up with **no ingress
container**: every service healthy, the site unreachable, nothing in the logs. `.env`
carries `COMPOSE_PROFILES=tunnel` so the bare command does the right thing.

Every service should reach `healthy`, and the `PORTS` column should be **empty for every
one of them**. If anything shows a published port, stop and find out why before continuing
— on this machine that is how a live site gets disturbed.

The entrypoint applies migrations and ensures the private bucket before the server starts:

```bash
docker compose logs --tail=200 app
```

Expect `applying database migrations`, then `ensuring the private storage bucket exists`,
then `starting HostelFlow`. If migrations fail the container exits rather than serving
against an un-migrated database.

## 6. Seed and create the owner

```bash
docker compose exec app npm run db:seed
docker compose exec app npm run bootstrap:owner
```

The seed creates H-K Boys Hostel: 3 floors, 36 rooms, 126 beds, both room types and the
configurable charges. It is idempotent.

The bootstrap prompts for name, email and password (12+ characters, not echoed) and
refuses to run once an owner exists. There is no public registration route; this is the
only way in.

Do **not** run `db:seed:demo` here. It creates fictional residents, and refuses to run
without being told the name of the target database.

## 7. Verify

```bash
curl -fsS https://hostel.yourdomain.com/api/health
```

Expect `{"status":"ok","database":"up","storage":"up"}`.

Then by hand:

- the site loads over HTTPS and redirects `/` to `/login`
- you can sign in as the owner
- `docker compose logs cloudflared | tail -20` shows a registered connection

And confirm the isolation holds — every one of these should fail to connect:

```bash
nc -zv hostel.yourdomain.com 5432    # PostgreSQL
nc -zv hostel.yourdomain.com 9000    # MinIO
nc -zv <server-ip> 3000              # the app itself
```

## 8. Confirm backups

```bash
docker compose logs backup | tail -20
docker compose exec backup ls -lh /backups/db /backups/objects
```

A dump should exist within a minute of startup. Then read
[backup-and-restore.md](backup-and-restore.md) and **rehearse a restore before the hostel
depends on this**.

## Living beside other projects

Things to hold to on a shared machine:

- **Never `docker system prune -a` or `docker volume prune`.** Those are machine-wide and
  will happily delete another project's images and data. Use
  `docker compose --profile tunnel down` scoped to this directory.
- HostelFlow's compose project is `hostelflow`, so its containers, networks and volumes are
  all prefixed. Nothing collides with the existing `smart-attendance_*` or `gikipanda_*`
  resources.
- Watch total memory: `free -h` before and after. HostelFlow's four containers want roughly
  1 GB.
- Restarting HostelFlow does not touch the other projects, and restarting theirs does not
  touch HostelFlow — the point of not sharing a reverse proxy.

### Unrelated, but worth fixing on this server

`smart-attendance-db` publishes `0.0.0.0:5432`, and `ufw` is inactive. That database is
reachable from anywhere the host is. Note also that enabling `ufw` would **not** close it:
Docker inserts its own iptables rules ahead of ufw's, a long-standing trap. The fix is in
that project's compose file:

```yaml
ports:
  - "127.0.0.1:5432:5432" # instead of "5432:5432"
```

then recreate that one container. `gikipanda-db` already does the equivalent by publishing
no ports at all.

## Updating

```bash
cd /opt/hostelflow
git fetch origin && git checkout main && git pull --ff-only
docker compose build app
docker compose --profile tunnel up -d app
docker compose logs --tail=100 app
```

Migrations apply automatically on start. Take a manual backup first:

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
no down-migrations. If a migration is wrong:

1. **Fix forward** — write a corrective migration. Almost always right, and the only option
   that keeps data added since.
2. **Restore from backup** — reverts the schema _and_ loses everything written since.

CI applies every migration to a fresh PostgreSQL on every push, which is the cheapest place
for a broken migration to be caught.

## Troubleshooting

**Site returns a Cloudflare 502** — cloudflared is up but cannot reach the app.
`docker compose ps` for the app's health, and check the public hostname points at
`app:3000` rather than `localhost:3000`.

**Tunnel shows no connection** — `docker compose logs cloudflared`. Almost always a wrong
or rotated `CLOUDFLARE_TUNNEL_TOKEN`.

**App unhealthy, Postgres healthy** — nearly always a `DATABASE_URL` password mismatch.

**Storage initialization fails** — `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` differ between
the `app` and `minio` services; both read the same `.env`.

**Bootstrap says an owner already exists** — it did its job. Add a second owner from inside
the application rather than from the CLI.

## What is not automated

- No DNS changes are made for you.
- No deployment happens without you running these commands.
- No production data is touched by CI.
- Nothing here modifies the other projects on the machine.
