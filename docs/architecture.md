# Architecture decisions

Decisions that were genuinely open, what was chosen, and why. Reversing any of these means
reading this file first.

## 1. One Next.js application, not an app plus an API service

A separate backend service would add a network hop, a second deployment, a second auth
surface and CORS, and buy nothing: there is one client, and it is the same app. Server
components read the database directly; mutations go through server actions and route
handlers. If a second client ever appears — a native app, an owner's reporting tool — that
is the moment to extract an API, not before.

## 2. Better Auth, not Auth.js

Both are credible. Better Auth wins on what this product actually needs:

| Requirement          | Better Auth                       | Auth.js v5                                                                 |
| -------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| Email/password       | Built in, scrypt hashing included | Credentials provider; the application hashes and verifies passwords itself |
| Database sessions    | Default, with a Prisma adapter    | Credentials sign-in forces JWT sessions                                    |
| Rate-limited sign-in | Built in, `storage: "database"`   | Application's problem                                                      |
| Phone OTP later      | First-party `phone-number` plugin | Custom provider                                                            |

Two of those matter disproportionately here. **Password hashing is not something to hand-roll** when the alternative ships it. And **database sessions** mean a compromised or
departing manager can be signed out immediately by deleting their session row — with a JWT
you wait for expiry or maintain a denylist, which is a database session with extra steps.

The `phone-number` plugin is the documented path to real OTP. The specification is explicit
that fake OTP must not be retained, and it is not: the simulated login is being replaced by
real credentials, and OTP arrives when there is an SMS provider behind it.

Nothing about authorization lives on the user record. Role and hostel come from
`HostelMembership`, resolved on every request.

## 3. Integrity in the database, not in application code

Every "at most one active X" rule is a unique index, not an `if`.

An application check reads, decides, then writes. Two requests can both read "this bed is
vacant" before either writes, and both then write. No amount of care in the handler fixes
that; the check and the write are not atomic. Locking the table serializes the whole hostel.
A unique index makes the second write fail, whatever the interleaving.

The mechanism is a nullable mirror column, set to the id while the row is live and NULL
once it is not. NULLs do not collide in a unique index, so history is preserved while only
one live row can exist:

| Rule                                     | Column                       | Constraint                |
| ---------------------------------------- | ---------------------------- | ------------------------- |
| One active allocation per bed            | `bed_allocation.activeBedId` | unique                    |
| One active hold per bed                  | `bed_hold.activeBedId`       | unique                    |
| One live admission per resident          | `admission.activeResidentId` | unique                    |
| One active CNIC per hostel               | `resident.activeCnicKey`     | unique with `hostelId`    |
| One rent invoice per admission per month | `invoice.monthlyKey`         | unique with `admissionId` |

`tests/integration/bed-allocation.test.ts` fires two concurrent transactions at one bed and
asserts exactly one wins.

The alternative — `SELECT … FOR UPDATE` on the bed row — also works and is worth knowing
about. It was not chosen because it only protects paths that remember to take the lock,
whereas the index protects every path including a future one written by someone who has not
read this file.

## 4. Money is an integer number of rupees

Every monetary column is `Int`, every monetary field is suffixed `Pkr`, and
`lib/domain/money.ts` refuses a non-integer at the boundary rather than rounding it.

PKR has no circulating subunit, so the whole rupee _is_ the minor unit and there is nothing
to round. Binary floating point cannot represent 0.1 exactly, and a deposit ledger that
drifts by a paisa per operation is a ledger that stops reconciling. Storing minor units as
integers is the standard answer; here the minor unit happens to be the rupee itself.

Parsing accepts `7500`, `7,500` and `Rs 7,500`, and rejects `7500.60` outright. Silently
turning that into 7501 is how a resident's balance ends up wrong by an amount nobody can
account for.

## 5. The deposit is a ledger, and verified payments are immutable

The security deposit is not a number on the resident. It is
`SecurityDepositLedger` rows — received, deduction, refund, adjustment — and the balance is
their sum. An editable balance column cannot answer "why is this Rs 2,500 and not
Rs 3,000?", which is the exact question a resident asks at checkout.

A `VERIFIED` payment is never edited or deleted. A correction is a new reversal row
pointing at the original through `reversalOfPaymentId`, carrying actor, timestamp and
reason. Money that can be quietly edited is money that can be quietly taken.

## 6. The audit trail is append-only by trigger

`audit_log` and `document_access_log` carry `BEFORE UPDATE` and `BEFORE DELETE` triggers
that raise an exception.

A `REVOKE` would not do it: the application owns these tables, and an owner can re-grant
itself any privilege it revoked. The trigger refuses the write for every role, including
the application's own. Audit foreign keys are `ON DELETE RESTRICT`, so history cannot be
erased by deleting the user it names — staff who leave are disabled through
`User.disabledAt`.

The deliberate consequence: an audit row can never be corrected. A wrong entry is answered
with a new entry, exactly like the financial ledgers.

Everything written passes through `lib/domain/redaction.ts` first, so a CNIC, a token or a
signed URL cannot reach the trail even by accident.

## 7. Configuration is validated lazily

`serverEnv()` parses and memoizes on first call rather than at import.

`next build` imports every route module to collect its configuration. Validating at import
would make a production build require a live `DATABASE_URL` and a real `AUTH_SECRET`, and a
build machine has no business holding either. The Prisma client and the Better Auth
instance are constructed on first use for the same reason; `prisma` is a proxy so call
sites still read `prisma.resident.findMany()`.

The property is checked, not assumed: CI builds with no secrets in the environment.

## 8. Private objects are proxied, not linked

Downloads go through `/api/documents/[id]`, which authorizes the request, records the
access, then streams the bytes. Signed URLs exist in `lib/server/storage.ts` for cases where
proxying would be wasteful, but they are not the default.

A signed URL is a bearer credential. Once issued it works until it expires, regardless of
whether the person who obtained it has since been signed out, had their access revoked, or
forwarded the link to a WhatsApp group. Proxying costs bandwidth and buys revocation.

Object keys are `hostel/<id>/<kind>/<uuid>.<ext>` — no CNIC, no name, no resident id. Keys
surface in logs and stack traces far more often than anyone expects.

Uploads are validated by magic bytes. A filename extension and a `Content-Type` header both
come from the uploader and are evidence of nothing.

## 9. Tenancy: not found, never forbidden

A record belonging to another hostel is reported as **404**, not 403. Answering "forbidden"
confirms the id exists, which turns the API into an oracle for enumerating another hostel's
residents. Authorization helpers throw rather than returning booleans, because a boolean
can be ignored by forgetting an `if`; a missing check therefore fails closed.

## 10. Structural seed and demo seed are separate programs

`prisma/seed.ts` creates rooms, beds, room types and charges. It is idempotent and safe in
production.

`prisma/seed-demo.ts` creates fictional residents and money, and refuses to run when
`NODE_ENV=production` or without `ALLOW_DEMO_SEED=true`. Inventing residents inside a real
hostel's records would corrupt the owner's data, so it is prevented rather than discouraged.

## 11. Tailwind stays on v3

Carried over from stabilization. v4 replaces the JavaScript config with CSS-first
configuration and rewrites the colour-opacity pipeline the approved design depends on.
Migrating is its own change, guarded by the design-token tests. See
[frontend-audit.md](frontend-audit.md).

## Still open

- **PDF generation** (PDFKit or similar) is not chosen yet; receipts are stored as a JSON
  snapshot plus an optional PDF object reference, so the decision is not blocked.
- **Email transport.** Without one, password reset is an owner-driven operation. A reset
  flow that silently never delivers is worse than none, so it stays off until there is a
  transport behind it.
- **Multi-hostel.** The schema is hostel-scoped throughout and `HostelMembership` is a
  join table, but `requireMembership` currently resolves a single membership per user.
  Supporting a user in several hostels needs a hostel switcher and a scoped session.
