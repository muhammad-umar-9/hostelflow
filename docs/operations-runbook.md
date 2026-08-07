# Operations runbook

Day-to-day operation of a running HostelFlow deployment. Written for whoever is on the
server at 11pm when something is wrong.

Deployment is in [server-deployment.md](server-deployment.md); backups are in
[backup-and-restore.md](backup-and-restore.md).

## Daily commands

```bash
cd /opt/hostelflow

docker compose ps                      # everything healthy?
curl -fsS https://$APP_DOMAIN/api/health
docker compose logs --tail=100 app
docker compose logs backup | tail -5   # did last night's backup finish?
docker system df                       # disk creeping up?
```

## Health

`/api/health` returns 200 with `{"status":"ok","database":"up","storage":"up"}`, or 503
with whichever component is `down`. It is unauthenticated and deliberately reports nothing
else — no version, no hostname, no counts.

| Symptom            | Look at                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `database: down`   | `docker compose logs postgres`; disk full; wrong password in `DATABASE_URL` |
| `storage: down`    | `docker compose logs minio`; MinIO credentials mismatched between services  |
| No response at all | `docker compose ps`; `docker compose logs caddy`; DNS; certificate          |

## Common tasks

### Add a manager

Owners add managers from inside the application. There is no CLI for it and no public
sign-up. If you find yourself wanting to create a user directly in the database, stop — the
account will have no password hash and no membership, and will not be able to sign in.

### Disable someone who has left

Do it from the application. It sets `User.disabledAt`, which is checked on **every**
request, so their existing session stops working immediately rather than at expiry.

Never delete a user who has done anything: the audit trail references them with
`ON DELETE RESTRICT` and the delete will be refused. That is intended — history keeps
naming who did what.

### Reset a forgotten owner password

There is no email transport yet, so there is no self-service reset. Either add a second
owner from a working account, or reset the hash directly:

```bash
docker compose exec app node -e '
  const { PrismaPg } = require("@prisma/adapter-pg");
  const { PrismaClient } = require("./lib/generated/prisma/client");
  // ... see docs/architecture.md; prefer adding a second owner instead
'
```

Adding a second owner is safer and leaves an audit trail. Treat the direct route as a last
resort.

### Change rent, deposit or the police-form charge

From Settings in the application. These are configuration rows (`RoomType.monthlyRentPkr`,
`ChargeType.defaultAmountPkr`), not constants in the code, and re-running the seed does not
revert them.

Changing a price does not alter existing admissions: each admission stores the rent agreed
at the time in `Admission.agreedMonthlyRentPkr`, so a price rise never silently rewrites an
existing resident's agreement.

### Apply an update

See [server-deployment.md](server-deployment.md#updating). Take a manual backup first.

### Free up disk

```bash
docker system df
docker image prune -f                       # unused images
docker compose exec backup ls -lh /backups/db
```

Reduce `BACKUP_RETENTION_DAYS` if backups dominate. Never delete the newest backup, and
never prune volumes — `docker volume prune` will destroy the database.

## Incidents

### The app is down

```bash
docker compose ps
docker compose logs --tail=200 app
docker compose restart app
```

If it exits on start, read the first error. Migration failures and configuration errors are
deliberately fatal: the entrypoint refuses to serve against an un-migrated database.

### The database will not start

Usually disk. `df -h`. Postgres refuses to start with no room for WAL.

If the data directory is corrupt, restore from backup — do not experiment on the only copy.

### Suspected unauthorized access

1. **Rotate `AUTH_SECRET`** in `.env` and `docker compose up -d app`. Every session is
   invalidated immediately; everyone signs in again.
2. Disable any suspect accounts from the application.
3. Read the audit trail — it cannot have been edited or deleted:
   ```sql
   SELECT "createdAt", action, "entityType", "actorUserId", "ipAddress", summary
   FROM audit_log ORDER BY "createdAt" DESC LIMIT 200;
   ```
4. Check document access specifically:
   ```sql
   SELECT l."createdAt", l."userId", l."ipAddress", o.kind
   FROM document_access_log l JOIN stored_object o ON o.id = l."objectId"
   ORDER BY l."createdAt" DESC LIMIT 200;
   ```
5. Change `POSTGRES_PASSWORD` and `MINIO_ROOT_PASSWORD` if the server itself may have been
   reached, and rebuild.

Personal data was likely exposed if resident records were read. That is a disclosure
decision for the owner, not a technical one; give them the facts from the audit trail.

### A bad migration reached production

Do not reach for a rollback — there are no down-migrations. Write a corrective migration
and deploy forward. Restore from backup only if the data is actually wrong, accepting the
loss of everything written since. See
[server-deployment.md](server-deployment.md#rollback-limitations).

## Monitoring worth adding

Not built yet; listed so it is a decision rather than an oversight.

- Uptime check on `/api/health` from outside the server
- Disk-space alert at 80%
- Alert when a backup run logs `ERROR`
- Alert on a spike of `auth.sign_in_failed` in the audit log

## Escalation

| Situation               | Action                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| App down, cause unclear | Restart; if it recurs, capture `docker compose logs` before restarting again |
| Data appears wrong      | **Stop writing.** Take a backup of the current state before any repair       |
| Suspected breach        | Rotate `AUTH_SECRET` first, investigate second                               |
| Disk nearly full        | Prune images, reduce retention; do not prune volumes                         |

Capture the logs before the restart that erases the evidence. It is the single most common
regret in an incident.
