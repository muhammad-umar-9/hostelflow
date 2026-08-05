# Security

What is protected, how, and what is still open. Written to be checkable: where a control
has a test, the test is named.

The data at risk is not abstract. It is a few hundred young men's CNIC images, their home
addresses, their guardians' phone numbers and their payment history, held by a small
business on a single server.

## Threat model

| Threat                                                     | Control                                                                                                      | Verified by                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Someone registers themselves into the system               | No public sign-up route exists; `disableSignUp` in `lib/server/auth.ts`. First owner via server CLI only     | —                                                   |
| Password guessing                                          | Sign-in limited to 5 attempts / 5 minutes, stored in PostgreSQL so it survives restarts and spans containers | —                                                   |
| Manager of hostel A reads hostel B's residents             | Every query is hostel-scoped; cross-tenant reads return 404, never 403                                       | `tests/integration/integrity.test.ts`               |
| Resident opens another resident's records by editing a URL | Residents never supply a resident id; it is derived from the session                                         | `lib/server/authz.ts`                               |
| CNIC images reachable without authorization                | Private bucket, no anonymous access, proxied downloads                                                       | `scripts/init-storage.ts` reports any bucket policy |
| A leaked link keeps working after sign-out                 | Downloads proxied per request rather than issued as signed URLs                                              | —                                                   |
| Malicious upload disguised as an image                     | Magic-byte validation, not extension or Content-Type                                                         | `tests/unit/uploads.test.ts`                        |
| Two residents allocated one bed                            | Unique index; concurrent claims resolve to one winner                                                        | `tests/integration/bed-allocation.test.ts`          |
| Quietly editing verified money                             | Payments immutable once VERIFIED; corrections are reversal rows                                              | —                                                   |
| Erasing the audit trail                                    | Append-only triggers refuse UPDATE and DELETE for every role                                                 | `tests/integration/integrity.test.ts`               |
| CNIC or token in logs                                      | Redaction before every audit write                                                                           | `tests/unit/redaction.test.ts`                      |
| Database reachable from the internet                       | Postgres and MinIO publish no ports and sit on an internal network                                           | `compose.yaml`                                      |
| Secrets in the browser bundle                              | `server-only` on every server module; no `NEXT_PUBLIC_` secret                                               | Build fails if violated                             |

## Authentication

- Better Auth, email and password, scrypt hashing. The application never sees a plaintext
  password at rest and never hashes one itself.
- Database-backed sessions, 8 hours, refreshed hourly. Deleting a session row signs that
  person out immediately — the reason database sessions were chosen over JWTs.
- Cookies are `httpOnly`, `sameSite: lax`, and `secure` in production.
- `User.disabledAt` is checked on **every** request, not only at sign-in, so a departing
  manager's live session stops working the moment they are disabled.
- Public sign-up is off. Accounts come from `npm run bootstrap:owner` on the server, or an
  owner inviting a manager.

## Authorization

Server-side, on every read and write. Hiding a button is not authorization.

- Role and hostel come from `HostelMembership`, never from a cookie, header or form field.
- Helpers throw typed errors instead of returning booleans, so a forgotten check fails
  closed rather than open.
- Owner-only: reversing a verified payment, approving a checkout deduction above the limit,
  changing prices and settings, reading the audit log. A manager runs the front desk; they
  do not get to quietly undo money.
- Per-manager overrides live in `HostelMembership.permissions`. An explicit `false` always
  wins; an unknown permission is denied, so adding a capability never grants it to every
  existing manager by accident.

## Personal data

- CNICs are stored normalized (13 digits) and **masked by default** — `35202-*****67-1`.
  The full value appears only on the protected resident-detail screen, to staff holding
  `residents.viewFullCnic`, and revealing it is an audited action.
- CNIC values never appear in object keys, URLs, log lines or audit summaries.
- Object keys are random UUIDs under `hostel/<id>/<kind>/`, identifying nobody.
- Every read of a private document writes a `DocumentAccessLog` row.

## Transport and headers

Caddy is the only public entry point and terminates HTTPS with automatically renewed
certificates. HTTP is redirected, never served.

HSTS (1 year, `includeSubDomains`, `preload`), `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
`Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, and a CSP that permits no
third-party scripts and no framing. The same headers are set in `next.config.ts` too, so
the app is not naked if it is ever run without the proxy.

`'unsafe-inline'` is present for scripts and styles: the Next.js bootstrap and Tailwind's
runtime style injection both require it. Removing it needs nonce-based CSP, which is
tracked below.

## Uploads

- Allowed: JPEG, PNG, WebP, PDF. Nothing else.
- Validated by file signature; a declared type that disagrees with the bytes is refused.
- 8 MB limit in the app, 10 MB in Caddy, so an oversized body is rejected at the edge.
- Random keys, SHA-256 recorded, upload audited.

## Network

Only Caddy publishes ports (80, 443, 443/udp). PostgreSQL and MinIO have no `ports:`
mapping and sit on a network marked `internal: true`, so they are unreachable from the host
and the internet regardless of the server's firewall. The MinIO browser console is off.

## Backups

`pg_dump` plus a MinIO archive, to a **separate volume**, with retention. A backup inside
the volume it protects is lost to the same failure.

Backups contain CNIC images and full financial history. Treat a backup file exactly like
the database: restrict access, and encrypt it if it leaves the server. See
[backup-and-restore.md](backup-and-restore.md).

## Secrets

- Generated on the server (`openssl rand -base64 48`), never in a chat window, never
  committed.
- `.env` is gitignored; `.env.example` holds placeholders only.
- `AUTH_SECRET` must be at least 32 characters or the app refuses to start.
- Rotating `AUTH_SECRET` signs everyone out, which is the intended response to exposure.

## Known gaps

Honest list. None of these is a reason to delay the milestone; all should close before the
system holds real residents.

1. **CSP allows `'unsafe-inline'`.** Nonce-based CSP is the fix.
2. **No email transport**, so no self-service password reset. Owner-driven for now.
3. **No 2FA.** Better Auth ships a `two-factor` plugin; worth enabling for the owner
   account before go-live.
4. **Upload rate limiting is not yet applied** to `/api/uploads`. Sign-in is limited;
   uploads are only size-limited. Track for the hardening milestone.
5. **Backups are not encrypted at rest** by the backup job. Fine for a volume on an
   encrypted disk; not fine if `BACKUP_DESTINATION` is remote.
6. **No intrusion detection or alerting.** A failed-sign-in spike is recorded in the audit
   log but nothing watches it.
7. **Restore has not been rehearsed.** A backup nobody has restored is a hypothesis.
   [backup-and-restore.md](backup-and-restore.md) has the drill; run it.

## Reporting a problem

This repository is public; the deployment is not. Report anything security-relevant
privately to the repository owner rather than opening an issue.
