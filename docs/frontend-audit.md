# Frontend audit and stabilization

Status: **stabilization milestone complete**. No backend work has started.

This document records what the handed-over Claude Design export actually contained, what
was changed to make it build and lint cleanly on supported dependencies, and what is
deliberately still mock-driven. It is the checklist the backend milestones work from.

The unmodified export is preserved on the `main` branch and tagged `baseline-export`.
All stabilization work is on `foundation/backend-integration`.

## 1. What the export is

- A real Next.js App Router + TypeScript frontend: 125 files in the baseline commit (123
  project files plus the two specification documents), 28 routes.
- Mobile-first design system: deep navy primary, emerald/amber/red status colours, CSS
  variables in `styles/globals.css`, shadcn-style primitives in `components/ui/`.
- A `HostelRepository` interface with a single `MockHostelRepository` implementation.
- No database, no server actions, no route handlers, no authentication, no storage, no
  Docker, no tests. Every screen is a client component driven by one in-memory snapshot.

## 2. Findings from the handoff audit, and their status

| #   | Finding                                                                     | Status                                                                    |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Real App Router frontend with a useful repository abstraction               | Confirmed; preserved                                                      |
| 2   | Next.js 15.1.6 is affected by published advisories                          | **Fixed** — Next 16.3.0, React 19.2.8, lockfile committed                 |
| 3   | `npm run typecheck` fails in `tailwind.config.ts` (`withAlpha()`)           | **Fixed** — see §4                                                        |
| 4   | `npm run build` fails during type checking for the same reason              | **Fixed** — production build passes                                       |
| 5   | Lint script needs migration after the upgrade                               | **Fixed** — ESLint flat config, `next lint` removed in Next 16            |
| 6   | README claims no component imports mock data; 15 files do                   | **Documented, not yet fixed** — see §6                                    |
| 7   | `HostelProvider` keeps the role in `localStorage` (demo UI state, not auth) | **Fixed** — resolved server-side from `HostelMembership`, no setter       |
| 8   | Login/OTP is simulated                                                      | **Fixed** — Better Auth email and password; OTP and role switcher deleted |
| 9   | Manifest exists, but no service worker or offline policy                    | Not started (Milestone 6)                                                 |
| 10  | No models, migrations, APIs, storage, Docker or meaningful tests            | Smoke tests added; the rest is the backend milestone                      |
| 11  | Detail screens use `?id=` query parameters                                  | **Documented, not yet fixed** — see §6                                    |
| 12  | PWA icons are SVG-only                                                      | **Documented, not yet fixed** — see §6                                    |

## 3. Dependency upgrade

`npm audit` reports **0 vulnerabilities** after the upgrade. Versions are pinned exactly
(no `^`) and `package-lock.json` is committed.

| Package                    | Was           | Now           | Note                                                                  |
| -------------------------- | ------------- | ------------- | --------------------------------------------------------------------- |
| next                       | 15.1.6        | 16.3.0        | Patched supported release; `next lint` is gone, Turbopack builds      |
| react / react-dom          | ^19.0.0       | 19.2.8        |                                                                       |
| eslint-config-next         | 15.1.6        | 16.3.0        | Flat config only                                                      |
| eslint                     | ^9.18.0       | 9.39.5        |                                                                       |
| typescript                 | ^5.7.3        | 5.9.3         | Stayed on TypeScript 5.x; 7.x is not yet validated against this stack |
| postcss                    | ^8.4.49       | 8.5.25        | The 8.4.x line carries four published advisories                      |
| @radix-ui/*                | 1.1.x / 2.1.x | current       | React 19 support                                                      |
| react-hook-form            | ^7.54.2       | 7.84.0        |                                                                       |
| @hookform/resolvers        | ^3.9.1        | 5.7.1         | Forced one typing fix, see §5                                         |
| lucide-react               | ^0.469.0      | 1.28.0        | No icon renames were needed                                           |
| zod                        | ^3.24.1       | 3.25.76       |                                                                       |
| tailwindcss                | ^3.4.17       | 3.4.19        | **Held on v3 on purpose**, see §7                                     |
| tailwind-merge             | ^2.6.0        | 2.6.0         | v3 targets Tailwind v4; held with Tailwind v3                         |
| prettier, @playwright/test | —             | 3.9.6, 1.62.1 | New                                                                   |

## 4. The Tailwind type error

`tailwind.config.ts` maps each themed colour through `withAlpha()`, which returns a
function so Tailwind can inject the opacity modifier (`border-p/40`). Tailwind resolves
such functions at run time, but its published `Config` type models colour leaves as
strings only, which is what broke `tsc` and therefore `next build`.

The function body is unchanged — same `var(--x)` output with no modifier, same
`color-mix()` output with one — so the palette and the runtime theme switching behave
exactly as in the approved design. Only the type surface changed: the resolver is now
built inside `withAlpha()` and returned through a single documented cast.

The alternative (rewriting the CSS variables as `rgb(r g b / <alpha-value>)` channel
triplets) was rejected: `--p`, `--bg` and `--ink` are also consumed directly as complete
colours in `styles/globals.css`, so that change would have rippled through the approved
theme definition for no functional gain.

`tests/e2e/design-tokens.spec.ts` pins this: the login shell must still paint
`#0f2a47`, `data-theme="green"` must repaint it to `#12402f`, and the built stylesheet
must contain both the plain `var(--p)` form and the `color-mix()` opacity form.

## 5. Other code changes

Beyond formatting, three fixes touched five source files:

- `tailwind.config.ts` — the typing fix above, plus `require("tailwindcss-animate")`
  replaced with an ESM import (the flat config forbids `require()` style imports).
- `components/forms/enquiry-form.tsx` + `lib/validations/index.ts` — `@hookform/resolvers`
  v5 types the resolver as `Resolver<input, context, output>`. `enquirySchema.roomType`
  coerces a `<select>` string into a number, so input and output types differ; TypeScript's
  inferred type predicates narrow the output to `3 | 4`. The form now declares
  `useForm<EnquiryInput, unknown, EnquiryValues>`, and `EnquiryInput` is exported next to
  `EnquiryValues`. No validation rule or message changed.
- `components/providers/hostel-provider.tsx`, `components/providers/theme-provider.tsx` —
  `eslint-plugin-react-hooks` v7 flags `setState` inside an effect body. All three sites
  are `localStorage` hydration or the initial snapshot fetch, and all three are scheduled
  for deletion in the backend milestone. They carry a narrow `eslint-disable-next-line`
  with the reason plus a `TODO(backend milestone)` pointing at the replacement. No
  behaviour changed.

Everything else in the diff is Prettier's first pass over the codebase (`printWidth: 90`,
`endOfLine: "lf"`), plus a `.gitattributes` that keeps the repository on LF.

That claim is checkable. Export the baseline, format it with the same Prettier config, and
diff it against the working tree: only the four files above under `app/`, `components/`
and `lib/` come back as different, and `tailwind.config.ts` outside them.

```bash
git archive baseline-export | tar -x -C /tmp/baseline
cp .prettierrc.json .prettierignore /tmp/baseline/
npx prettier --write "/tmp/baseline/{app,components,lib}/**/*.{ts,tsx}" "/tmp/baseline/styles/*.css"
diff -rq /tmp/baseline/app app; diff -rq /tmp/baseline/components components
diff -rq /tmp/baseline/lib lib; diff -rq /tmp/baseline/styles styles
```

## 6. Remaining mock and demo dependencies

Nothing in this list was fixed during stabilization. Each is real work for a later
milestone, and each is a correctness or security issue if it ships as-is.

### 6.1 Direct mock-data imports (15 production files)

The README's claim that no component imports mock data is false. `@/lib/mock-data`
is imported by:

```
app/dashboard/page.tsx                  getStats
app/payments/page.tsx                   getResident
app/payments/proofs/page.tsx            getResident
app/payments/proofs/detail/page.tsx     getResident
app/receipts/page.tsx                   getResident
app/receipts/detail/page.tsx            getResident
app/residents/page.tsx                  getInvoice
app/residents/detail/page.tsx           getInvoice, getResident
app/rooms/detail/page.tsx               getResident
app/resident-portal/page.tsx            getInvoice, getResident
app/resident-portal/payments/page.tsx   getInvoice, getResident
app/resident-portal/profile/page.tsx    getResident
app/admissions/success/page.tsx         getResident
components/forms/checkout-wizard.tsx    getInvoice, getResident
components/payments/reminder-dialog.tsx getInvoice, getResident
```

Plus `lib/repository/mock-repository.ts`, which is legitimate: it is the mock
implementation and stays behind the repository interface for tests and development.

These selectors are pure functions over an in-memory `HostelData` snapshot. Replacing
them means fetching the specific records a screen needs on the server, per role — not
swapping one global snapshot for another.

### 6.2 The global snapshot pattern

`HostelProvider` loads the entire hostel through `hostelRepository.getSnapshot()` into one
client-side object and mutates it locally. Every screen reads from it. This cannot survive
contact with a real multi-user database: it over-fetches, it cannot authorize per record,
and concurrent writes silently overwrite each other. It is replaced, not ported.

### 6.3 Demo role switching is not authorization — **fixed**

`HostelProvider` stored `hostelflow.role` in `localStorage` and `RoleSwitcher` changed it
from the sidebar, More and the login screen, so one line in a device console promoted a
resident to owner.

The switcher is deleted. The role is resolved on the server from `HostelMembership` in the
root layout and passed down as a prop with no setter, so a client component can read it and
cannot write it. It still decides only which navigation renders: every action behind an
owner-only control calls `requireOwner()` for itself.

### 6.4 Simulated login — **fixed**

`components/forms/login-form.tsx` filled a hard-coded OTP (`4291`) after a `setTimeout` and
"signed in" by setting the demo role. There was no credential, no session and no server
call.

Replaced with Better Auth email and password against the database. Public sign-up is
disabled; the first owner comes from `npm run bootstrap:owner` on the server. The phone-OTP
plugin remains the documented upgrade path when an SMS provider is added.

The authentication boundary is `app/layout.tsx`, which resolves the session against the
database and redirects before any page renders. `middleware.ts` is a latency optimisation
only — it checks that a cookie exists, without verifying it, because the edge runtime
cannot open a database connection.

### 6.5 Sensitive records addressed by query parameter

Ten screens read their record from `useSearchParams()`, including
`/residents/detail?id=`, `/payments/proofs/detail?id=`, `/receipts/detail?id=` and
`/checkout?resident=`. These become validated dynamic segments (`/residents/[id]`) with
server-side authorization on every request.

### 6.6 PWA gaps

- Icons are SVG-only; production PNG and maskable PNG icons are still needed.
- There is no service worker, no offline shell and no install verification.
- `start_url` is `/dashboard`, which is wrong for a resident session.

### 6.7 Accessibility note found while writing the smoke tests

`/resident-portal` renders no `<h1>` — the resident's name is a styled `<p>`. Every other
main route has exactly one `<h1>` through `PageHeader`. Worth fixing when that screen is
connected to real data.

## 7. Deliberately deferred

- **Tailwind stays on v3.4.x.** v4 replaces the JavaScript config with CSS-first
  configuration and rewrites the colour-opacity pipeline this design depends on. Migrating
  it during a stabilization pass would put the approved visual design at risk for no
  security benefit. Revisit as its own change, with the design-token tests as the guard.
- **Zod stays on 3.25.x.** v4 is a valid target once server-side schemas exist and can be
  migrated together with the client ones.
- **TypeScript stays on 5.9.x.** The 7.x native compiler is not yet something this stack is
  validated against.

## 8. Commands and results

Run from `hostelflow-frontend/`:

| Command                | Result                                                       |
| ---------------------- | ------------------------------------------------------------ |
| `npm run format:check` | pass — all files match Prettier                              |
| `npm run lint`         | pass — 0 errors, 0 warnings                                  |
| `npm run typecheck`    | pass — 0 errors                                              |
| `npm run build`        | pass — 28 routes prerendered                                 |
| `npm run test:e2e`     | pass — 50 tests (25 × mobile Pixel 7, 25 × desktop 1280×900) |
| `npm audit`            | 0 vulnerabilities                                            |

`npm run verify` chains format, lint, typecheck and build. The smoke suite builds and
starts the production server itself, so `npm run test:e2e` needs no separate build step.
