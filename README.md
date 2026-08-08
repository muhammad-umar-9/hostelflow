# HostelFlow — frontend

Mobile-first Next.js frontend for **H-K Boys Hostel** (Lahore): rooms and beds, walk-in
enquiries, admissions, monthly rent, payment-proof approval, receipts, police verification,
checkout with security settlement, and a resident companion portal.

> **Status: the platform exists, the screens do not use it yet.**
>
> PostgreSQL, authentication, per-record authorization, the audit trail, private object
> storage and the containerized deployment are all built and tested. **Every screen is
> still driven by mock data** — converting them starts with the next branch,
> `feature/admission-vertical-slice`.
>
> So: the login you see is still the demo one, and every number on every screen is still
> invented. `docs/frontend-audit.md` tracks exactly what is still mock-driven.
> `PROJECT_SPEC.md` is the product specification; `CLAUDE.md` is the working agreement.

## How it fits together

| Layer                                                             | State                                     |
| ----------------------------------------------------------------- | ----------------------------------------- |
| Next.js 16 App Router, Tailwind, shadcn-style components          | Built, unchanged design                   |
| PostgreSQL via Prisma 7, 30 models, migration committed           | Built, not yet applied to a live database |
| Better Auth: email/password, database sessions, no public sign-up | Built                                     |
| Authorization: role and hostel resolved per request               | Built                                     |
| Append-only audit trail, enforced by database trigger             | Built                                     |
| MinIO private storage, proxied downloads, magic-byte validation   | Built                                     |
| Docker Compose: app, postgres, minio, caddy, backup               | Built, not yet deployed                   |
| Screens reading real data                                         | **Not started**                           |

## Requirements

- Node.js 20.9 or newer (Next.js 16 requirement; Node 22 LTS recommended)
- npm 10 or newer

## Install and run

```bash
npm install
npm run dev      # http://localhost:3000
```

Production build and start:

```bash
npm run build
npm run start
```

Checks:

```bash
npm run format:check     # Prettier
npm run lint             # ESLint (flat config)
npm run typecheck        # tsc --noEmit
npm run test             # Vitest unit tests
npm run verify           # all of the above, then a production build
npm run test:e2e         # Playwright route smoke tests (builds and starts the app itself)
npm run test:integration # database tests — needs TEST_DATABASE_URL, see below
```

The Playwright suite needs its browser once: `npx playwright install chromium`.

### Database commands

```bash
npm run db:generate        # regenerate the Prisma client
npm run db:validate        # check the schema
npm run db:migrate:deploy  # apply migrations (needs DATABASE_URL)
npm run db:seed            # hostel, rooms, beds, charges — safe in production
npm run db:seed:demo       # fictional residents — refuses to run in production
npm run bootstrap:owner    # create the first owner account
```

### Running the database tests

They create and delete rows, so they read `TEST_DATABASE_URL` and deliberately ignore
`DATABASE_URL` — a variable that is often already set in a shell, pointing at something
else entirely. Without it the suite skips loudly rather than pretending to pass.

```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/hostelflow_test npm run test:integration
```

CI runs them on every push against a throwaway PostgreSQL service container, which is where
they actually execute for this project — see `.github/workflows/ci.yml`.

### Configuration

Copy `.env.example` to `.env` and read the comments; every variable is documented there.
Generate secrets on the server with `openssl rand -base64 48`, never in a chat window and
never committed. Nothing may be renamed to `NEXT_PUBLIC_*` — that prefix ships the value to
every browser.

## Deployment

`docs/server-deployment.md` has the full procedure. In short:

```bash
cp .env.example .env    # then fill it in on the server
docker compose build
docker compose --profile tunnel up -d          # note the profile
docker compose exec app npm run db:seed
docker compose exec app npm run bootstrap:owner
```

**The profile is not optional.** `docker compose up -d` without one starts the app,
database, storage and backup with no ingress container at all: everything reports healthy
and the site is simply unreachable, with nothing in the logs to say why.

- `--profile tunnel` — the default shape. Nothing publishes a port; cloudflared dials out
  to Cloudflare and traffic arrives over that connection. Use this on a server that is
  already running other things.
- `--profile standalone` — a dedicated machine, where Caddy takes 80/443 and terminates
  TLS itself.

Either way PostgreSQL and MinIO sit on an internal network, unreachable from the host.

Also see `docs/security.md`, `docs/backup-and-restore.md` and `docs/operations-runbook.md`.

## Signing in

Real email and password, through Better Auth, against the database. There is no public
sign-up: the first account is created on the server with `npm run bootstrap:owner`, and
further accounts are created by an owner.

The role — owner, manager or resident — is resolved server-side from `HostelMembership` on
every request and passed down for rendering only. It decides which navigation is drawn; it
never decides what is permitted. Every action re-checks with `requireOwner()` /
`requireMembership()` on the server, because the button is drawn on a machine we do not
control.

Until this milestone the login screen accepted a hard-coded OTP (`4291`), which it filled
in for the visitor, and offered three DEMO ROLE buttons whose choice was stored in
`localStorage`. Anyone who could load the page could be the owner. Both are gone, and a
smoke test fails if either string reappears.

`Reset demo data` (sidebar / More) restores the hostel to its starting state while the
screens are still mock-driven.

## End-to-end tests

`npm run test:e2e` builds the app, starts it, and runs Playwright against the production
build. The authenticated screens need a database to sign in to:

```bash
E2E_DATABASE_URL=postgresql://user:pass@host:5432/hostelflow_e2e npm run test:e2e
```

The suite **migrates, seeds and writes to that database**, so it reads `E2E_DATABASE_URL`
and deliberately ignores `DATABASE_URL` — the same rule the integration suite follows, for
the same reason. `scripts/e2e-owner.ts` additionally refuses any URL whose database name
does not contain `test` or `e2e` as a word.

Without the variable the public checks still run and the authenticated ones **skip loudly**
rather than reporting as passed. Under CI a missing variable is a hard failure, because a
skipped suite and a passing suite look identical in the summary line.

## Routes

| Route                                     | Screen                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `/login`                                  | Splash, email and password sign-in                               |
| `/dashboard`                              | Owner / manager dashboard, occupancy, collection, attention list |
| `/rooms`                                  | Rooms grouped by floor, type / vacancy / floor filters           |
| `/rooms/detail?no=101`                    | Room detail, bed layout, bed action sheet                        |
| `/enquiries`                              | Walk-in enquiry pipeline                                         |
| `/enquiries/detail?id=E-41`               | Lead detail, matching beds, hold, convert to admission           |
| `/residents`                              | Resident directory with search and filters                       |
| `/residents/detail?id=R1001`              | Resident profile: overview, documents, payments, activity        |
| `/admissions/new`                         | Seven-step admission wizard                                      |
| `/admissions/upload`                      | Student self-upload page opened from the WhatsApp link           |
| `/admissions/success`                     | Admission confirmation and receipt actions                       |
| `/payments`                               | Monthly rent list, filters, bulk WhatsApp reminders              |
| `/payments/proofs`                        | Payment-proof approval queue                                     |
| `/payments/proofs/detail?id=PP-210`       | Proof review: approve, partial, reject with reason               |
| `/receipts` and `/receipts/detail?id=...` | Receipt list and printable receipt                               |
| `/police-verification`                    | Verification tracker grouped by stage                            |
| `/checkout?resident=R1001`                | Guided checkout and security settlement                          |
| `/resident-portal`                        | Resident home                                                    |
| `/resident-portal/payments`               | Resident payments and receipts                                   |
| `/resident-portal/requests`               | Maintenance requests                                             |
| `/resident-portal/profile`                | Resident profile (read-only fields)                              |
| `/settings`                               | Hostel, charges, payment details, permissions, theme             |
| `/more`                                   | Secondary navigation, log out, demo reset                        |
| `/notifications`                          | Role-aware notification list                                     |

Detail screens read their record from a query parameter (`?id=`, `?no=`) rather than a
dynamic `[id]` segment. Swapping them to dynamic segments later is mechanical: move the
folder to `[id]`, and replace `useSearchParams()` with `useParams()` in that one file.

## Clickable journeys

1. **Admit a four-seater resident** — Dashboard → Add Resident → details → documents →
   Room 101 Bed D → Rs 10,800 → payment → confirm → receipt. The bed becomes occupied.
2. **Admit a three-seater resident** — Rooms → three-seater filter → vacant bed → allocate →
   Rs 12,300 → submit proof → status Under Review.
3. **Approve a payment proof** — Dashboard alert → Payment proofs → open → Approve. The
   invoice becomes paid and a receipt is generated.
4. **Send overdue reminders** — Payments → Unpaid and overdue → select → Preview reminder →
   Send. Rows are marked "Reminder sent".
5. **Checkout a resident** — Resident profile → Start checkout → dues → damage deduction →
   refund → confirm. Settlement receipt is generated and the bed becomes vacant.
6. **Convert an enquiry** — Enquiries → open lead → matching beds → Hold bed → Convert to
   admission (name, phone and joining date pre-filled).

## Architecture

```text
app/           route-per-screen (App Router, client components where state is needed)
components/
  ui/          shadcn-style primitives: button, card, badge, dialog, sheet, tabs, ...
  layout/      app shell, desktop sidebar, bottom nav, page header, role switcher
  dashboard/   occupancy, collection, quick actions, attention list
  rooms/       room card, bed chip, bed action sheet
  residents/   avatar, resident card, search, police status sheet
  payments/    rent row, proof card, reminder dialog, receipt view
  forms/       admission wizard steps, checkout wizard, login, enquiry
  providers/   HostelProvider (state + mutations), ThemeProvider
lib/
  types/       every domain type
  mock-data/   deterministic H-K Boys Hostel generator + selectors
  repository/  HostelRepository interface + MockHostelRepository
  formatters/  Rs 9,000 · 04 Aug 2026 · 0300 1234567 · CNIC masking
  validations/ Zod schemas used by React Hook Form
  constants/   month, labels, floors, payment methods
docs/          frontend audit and architecture notes
public/        PWA manifest, icons, placeholder images
styles/        Tailwind layers and CSS colour variables
tests/e2e/     Playwright route smoke tests and design-token guards
```

### Replacing mock data with a real backend

`lib/repository/index.ts` exports a single `hostelRepository` instance, so the data source
has one swap point:

```ts
export const hostelRepository: HostelRepository = new ApiHostelRepository(baseUrl);
```

That alone is **not** enough, for two reasons.

1. Fifteen screens and components still import `@/lib/mock-data/selectors` directly and
   bypass the repository entirely. They are listed in `docs/frontend-audit.md`.
2. The repository hands the whole hostel to the browser as one snapshot. A real
   multi-user system has to fetch per screen and per role on the server, so records can be
   authorized individually. The snapshot pattern is replaced rather than reimplemented.

## Design rules kept from the approved prototype

- Deep navy primary (`--p`), emerald for success, amber for pending, red for overdue.
- Colours are CSS variables in `styles/globals.css`; `data-theme="green"` and `"teal"` are
  provided as alternates and switchable in Settings.
- Plus Jakarta Sans for UI, IBM Plex Mono for references and CNIC, Noto Nastaliq Urdu for
  the Urdu labels beside key actions.
- Rs formatting, `04 Aug 2026` dates, `0300 1234567` phone numbers.
- Touch targets are at least 44px; mobile keeps a bottom navigation bar, tablet and desktop
  switch to a left sidebar.

## Data and privacy

Names, CNIC numbers, phone numbers and transaction references are fictional. CNIC digits
are masked everywhere except inside an authorised resident profile. The security deposit is
always tracked separately from rent and is only released through the checkout flow.

## PWA

`public/manifest.webmanifest` with standalone display, portrait orientation, theme colour
`#0f2a47`, maskable icon and app shortcuts. Metadata and viewport are declared in
`app/layout.tsx`.

Not installable-ready yet: the icons are SVG-only (production needs PNG and maskable PNG),
there is no service worker or offline shell, and `start_url` points at `/dashboard`, which
is the wrong landing page for a resident. See `docs/frontend-audit.md`.
