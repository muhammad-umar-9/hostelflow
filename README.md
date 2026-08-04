# HostelFlow — frontend

Mobile-first Next.js frontend for **H-K Boys Hostel** (Lahore): rooms and beds, walk-in
enquiries, admissions, monthly rent, payment-proof approval, receipts, police verification,
checkout with security settlement, and a resident companion portal.

All data is typed mock data behind a repository interface. No backend, no database, no
secrets in this project.

## Requirements

- Node.js 18.18 or newer (Node 20 LTS recommended)
- npm 9 or newer

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

Type check and lint:

```bash
npm run typecheck
npm run lint
```

Copy `.env.example` to `.env.local` if you want to override the app name or point the app
at a real API later. Nothing in this project requires a secret.

## Demo roles

The login screen (`/login`) has a demo role selector: **Owner**, **Manager**, **Resident**.
The role is also switchable at any time from the sidebar on desktop and from **More** on
mobile, so a live demo never has to log out. Owner and Manager share the staff navigation;
Resident gets the smaller companion navigation.

`Reset demo data` (sidebar / More) restores the hostel to its starting state.

## Routes

| Route | Screen |
| --- | --- |
| `/login` | Splash, phone + OTP, demo role selector |
| `/dashboard` | Owner / manager dashboard, occupancy, collection, attention list |
| `/rooms` | Rooms grouped by floor, type / vacancy / floor filters |
| `/rooms/detail?no=101` | Room detail, bed layout, bed action sheet |
| `/enquiries` | Walk-in enquiry pipeline |
| `/enquiries/detail?id=E-41` | Lead detail, matching beds, hold, convert to admission |
| `/residents` | Resident directory with search and filters |
| `/residents/detail?id=R1001` | Resident profile: overview, documents, payments, activity |
| `/admissions/new` | Seven-step admission wizard |
| `/admissions/upload` | Student self-upload page opened from the WhatsApp link |
| `/admissions/success` | Admission confirmation and receipt actions |
| `/payments` | Monthly rent list, filters, bulk WhatsApp reminders |
| `/payments/proofs` | Payment-proof approval queue |
| `/payments/proofs/detail?id=PP-210` | Proof review: approve, partial, reject with reason |
| `/receipts` and `/receipts/detail?id=...` | Receipt list and printable receipt |
| `/police-verification` | Verification tracker grouped by stage |
| `/checkout?resident=R1001` | Guided checkout and security settlement |
| `/resident-portal` | Resident home |
| `/resident-portal/payments` | Resident payments and receipts |
| `/resident-portal/requests` | Maintenance requests |
| `/resident-portal/profile` | Resident profile (read-only fields) |
| `/settings` | Hostel, charges, payment details, permissions, theme |
| `/more` | Secondary navigation, role switch, demo reset |
| `/notifications` | Role-aware notification list |

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
public/        PWA manifest, icons, placeholder images
styles/        Tailwind layers and CSS colour variables
```

### Replacing mock data with your API

`lib/repository/index.ts` exports a single `hostelRepository` instance. Implement
`HostelRepository` against your PostgreSQL API and change that one line:

```ts
export const hostelRepository: HostelRepository = new ApiHostelRepository(baseUrl);
```

No component imports mock data directly, so nothing else changes.

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
`app/layout.tsx`. Add a service worker (for example `next-pwa`) when you need offline
caching — it was left out so the export has no build-time surprises.
