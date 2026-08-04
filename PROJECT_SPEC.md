# HostelFlow — Master Build Prompt for Claude Code

Copy everything below this line and give it to Claude Code at the root of a new repository.

---

You are a senior full-stack engineer, product architect, database designer, security engineer and QA lead. Build a production-quality, self-hosted Progressive Web Application named **HostelFlow** for independently operated private hostels in Pakistan.

The first pilot is **H-K Boys Hostel, Lahore**, but the architecture must support multiple independent hostels later. Do not build a university hostel system. The product should replace paper registers, Excel sheets, manual calculations and WhatsApp payment screenshots used by private-hostel owners.

## 1. Working method

Before coding:

1. Inspect the repository and preserve any useful existing work.
2. Create a concise implementation plan and proposed directory structure.
3. Identify assumptions, but do not block on non-critical missing information. Put environment-specific values in configuration or environment variables.
4. Implement in vertical, testable milestones. At the end of every milestone, run linting, type checking and relevant tests and fix all failures.
5. Do not create attractive but disconnected mock screens. Main journeys must persist real records in PostgreSQL and correctly change related state.
6. Do not leave core journeys as TODOs, dead buttons, fake API responses or hard-coded client-side state.
7. Prefer maintainable, explicit code over unnecessary abstraction.
8. Record important architectural decisions in `docs/architecture.md`.

If the entire scope cannot be completed safely in one pass, finish the current milestone in a working state and produce a clear continuation checklist. Never sacrifice authorization, database integrity or file privacy to make more screens appear complete.

## 2. Fixed technology stack

Use this stack unless an existing repository already has an equivalent, sound choice:

- Next.js with App Router and TypeScript
- Progressive Web App with web manifest and service worker
- Tailwind CSS
- shadcn/ui components
- PostgreSQL
- Prisma ORM with committed migrations
- Auth.js or Better Auth for authentication; select one and document the reason
- React Hook Form and Zod
- TanStack Query where client-side server-state caching is useful
- Zustand only for temporary multi-step form state or lightweight UI state
- IndexedDB through Dexie for offline drafts and a clearly visible sync queue
- MinIO, using its S3-compatible API, for private document storage
- Server-generated PDFs using PDFKit or another dependable server-side PDF library
- Docker Compose for local and production deployment
- Caddy as the default HTTPS reverse proxy, unless the repository already uses Nginx
- Vitest or Jest for unit/integration tests
- Playwright for end-to-end tests
- ESLint and Prettier

Use only actively maintained dependencies. Lock dependency versions and do not expose secrets to the browser.

## 3. Deployment target

The application will run on the owner's server under Ubuntu. Create a containerized deployment containing at minimum:

- `app`: Next.js application
- `postgres`: PostgreSQL database
- `minio`: private object storage
- `caddy`: HTTPS reverse proxy
- a safe database and object-storage backup mechanism

Provide:

- `Dockerfile`
- `compose.yaml`
- `.env.example` with explanatory comments but no secrets
- health checks
- persistent named volumes
- database migration and seed commands
- production deployment instructions
- backup and restore instructions
- first-admin bootstrap procedure

Do not assume localhost in production. Configure the public application URL, database URL, authentication secret, MinIO endpoint and credentials through environment variables.

Required production safeguards:

- HTTPS only
- secure, HTTP-only, same-site cookies
- no default production passwords
- rate limiting on login and document-upload routes
- request and upload size limits
- MIME-type and file-signature validation
- security headers
- CSRF protection where applicable
- database connection pooling
- structured server logs without CNIC numbers, passwords, tokens or signed URLs
- automated backups stored outside the primary application volume
- documented restore test

## 4. Pilot-hostel configuration

Seed the demo with:

- Hostel: H-K Boys Hostel
- City: Lahore
- Total rooms: 36
- Approximately 18 three-seater rooms
- Approximately 18 four-seater rooms
- Approximate total capacity: 126 beds
- Three-seater monthly rent per bed: PKR 9,000
- Four-seater monthly rent per bed: PKR 7,500
- Refundable security deposit: PKR 3,000
- One-time police-form charge: PKR 300

Initial admission calculations:

- Four-seater: PKR 7,500 rent + PKR 3,000 security + PKR 300 police charge = PKR 10,800
- Three-seater: PKR 9,000 rent + PKR 3,000 security + PKR 300 police charge = PKR 12,300

These values must be editable configuration, not business logic hard-coded throughout the source.

Use integer minor units or integer PKR values consistently for money. Never use binary floating-point values for financial calculations.

## 5. Users and authorization

Implement three roles:

### Owner

- Full access to their own hostel
- Dashboard and reports
- Manage managers and permissions
- Configure rooms, prices, charges and payment methods
- Review financial history
- Approve sensitive checkout adjustments
- View audit logs

### Manager

- Manage enquiries and residents
- Allocate and move beds
- Upload resident documents
- Record and review payments
- Update police-verification status
- Start and complete ordinary checkouts
- Cannot permanently delete verified financial records
- Cannot change owner accounts or access another hostel

### Resident

- View only their own profile, allocation, invoices, receipts, notices and requests
- Upload their own payment proof
- Update permitted contact fields
- Cannot approve payments, change rent, change allocation, see another resident or modify deposit records

Enforce permissions on the server for every read and write. Hiding a button is not authorization. Every hostel-scoped record must be checked against the authenticated user's hostel membership.

Support an initial password-based login for owner and manager. Structure authentication so phone OTP can be added later. Do not implement fake OTP security. Resident login may initially use a securely issued invitation and password setup.

## 6. Core data model

Design a normalized Prisma schema with migrations. Include UUID or CUID primary keys, timestamps and hostel scoping where applicable.

At minimum model:

- `Hostel`
- `User`
- `HostelMembership`
- `Floor`
- `RoomType`
- `Room`
- `Bed`
- `Enquiry`
- `Resident`
- `Guardian`
- `ResidentDocument`
- `Admission`
- `BedAllocation`
- `ChargeType`
- `Invoice`
- `InvoiceLine`
- `Payment`
- `PaymentAllocation`
- `PaymentProof`
- `SecurityDepositLedger`
- `PoliceVerification`
- `Checkout`
- `DamageDeduction`
- `Receipt`
- `MaintenanceRequest`
- `Notification`
- `AuditLog`

Important data rules:

1. A bed can have at most one active allocation.
2. A resident can have at most one active admission in the same hostel.
3. Active resident CNIC must be unique within a hostel, while historical records must remain preserved.
4. A payment may be allocated to one or more invoice lines, and partial payment must be supported.
5. Verified payments are immutable. Corrections use reversal or adjustment records with actor, timestamp and reason.
6. Security deposit is a ledger, not a simple editable number. Preserve received, deduction, refund and adjustment entries.
7. Checkout never deletes the resident, admission, financial or document history.
8. Room capacity must match the number of active bed records.
9. A temporarily held bed must expire at a configured time or be released manually.
10. Police-form charge and police-verification status are separate concepts. Paying PKR 300 does not mean the resident is verified.
11. Use database transactions for admission confirmation, payment approval, bed movement and checkout.
12. Protect against race conditions and double allocation using database constraints and transactional checks, not client checks alone.

Recommended status enums:

- Bed: `VACANT`, `HELD`, `OCCUPIED`, `CHECKOUT_PENDING`, `MAINTENANCE`
- Enquiry: `NEW`, `VISIT_SCHEDULED`, `VISITED`, `BED_HELD`, `ADMITTED`, `LOST`
- Invoice: `DRAFT`, `ISSUED`, `PARTIAL`, `PAID`, `OVERDUE`, `VOID`
- Payment proof: `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `CLEARER_PROOF_REQUIRED`
- Payment: `PENDING`, `VERIFIED`, `REVERSED`
- Police verification: `NOT_STARTED`, `DOCUMENTS_INCOMPLETE`, `FORM_PREPARED`, `SUBMITTED`, `VERIFIED`, `CORRECTION_REQUIRED`
- Admission: `PENDING`, `ACTIVE`, `CHECKOUT_PENDING`, `CLOSED`, `CANCELLED`

Store CNIC values normalized for comparison, display them in Pakistani format, mask them in lists and logs, and reveal the complete value only to explicitly authorized staff on the protected resident-detail screen.

## 7. Private document storage

Use MinIO private buckets for:

- resident photographs
- CNIC/B-Form front and back images
- guardian documents
- payment proofs
- police-form acknowledgements
- checkout damage photographs
- generated receipts and settlement PDFs

Never make these objects publicly readable. Store only object metadata and keys in PostgreSQL. Serve protected files through an authorized server route or short-lived signed URL after permission checks.

Validate:

- authenticated role and hostel
- accepted image/PDF types
- file signatures, not only filename extensions
- maximum size
- sanitized generated object keys

Generate random object identifiers. Do not put full CNIC values into filenames or object keys. Preserve an audit record for protected-document access where practical.

## 8. User experience and design system

Build mobile-first responsive screens that also work well on a laptop. The PWA should be installable from supported browsers and open in standalone mode.

Design direction:

- primary color: deep navy
- white or very light grey surfaces
- emerald green: successful payments and vacant beds
- amber: pending actions
- red: overdue payments or urgent issues
- rounded but restrained cards
- large touch targets
- clear typography
- Pakistani rupee formatting such as `Rs 9,000`
- date style such as `04 Aug 2026`
- phone style such as `0300 1234567`
- accessible labels, keyboard navigation and color contrast
- English interface with optional Urdu labels beside critical actions through a translation-ready dictionary

Owner/manager navigation:

- Home
- Rooms
- Residents
- Payments
- More

Resident navigation:

- Home
- Payments
- Requests
- Profile

Do not use university terminology or create unnecessary corporate dashboards.

## 9. Required functional modules

### A. Owner dashboard

Show real database-derived values:

- total beds
- occupied beds
- vacant beds
- held and maintenance beds
- occupancy percentage
- rent expected this month
- amount collected
- outstanding amount
- pending payment proofs
- overdue residents
- pending police forms
- upcoming checkouts

Include one occupancy progress bar and one rent-collection progress bar. Dashboard attention cards must link to correctly filtered lists.

### B. Room and bed management

- Group rooms by floor.
- Filter by room type, floor and occupancy.
- Display individual Bed A/B/C/D states.
- Open room details with current residents.
- Allocate a vacant bed.
- Hold a bed for an enquiry with expiration.
- Mark a bed under maintenance.
- Move an active resident transactionally.
- Block any double allocation.

### C. Enquiry pipeline

Capture:

- name
- WhatsApp number
- preferred room type
- expected joining date
- source: walk-in, WhatsApp, Facebook, referral or property listing
- notes
- status and activity history

Support matching vacant beds, visit scheduling, temporary holds, conversion to admission and lost reason.

### D. Resident admission wizard

Implement a resumable multi-step flow:

1. Personal information
2. Guardian and emergency information
3. Document uploads
4. Vacant room and bed selection
5. Charge calculation
6. Payment recording or proof submission
7. Review and confirmation

Personal fields:

- full name
- CNIC/B-Form number
- date of birth
- phone/WhatsApp number
- permanent address and city
- educational institution or workplace
- student/employee status
- joining date

Guardian fields:

- name
- relationship
- CNIC number
- phone number
- emergency contact name and number

Documents:

- resident photo
- CNIC/B-Form front
- CNIC/B-Form back
- optional guardian CNIC
- optional student card or admission proof

Payment methods:

- cash
- bank transfer
- JazzCash
- Easypaisa

For digital payments collect amount, reference, sender identifier, date and proof image. For cash require an authenticated manager confirmation.

Admission confirmation must atomically:

- recheck that the selected bed is still available
- create or activate the resident and admission
- create the bed allocation
- create invoice and invoice lines
- record payment/proof if supplied
- create the deposit ledger entry where applicable
- initialize police-verification status
- update bed status
- write audit logs
- generate the admission receipt when payment is verified

### E. Resident directory and profile

Search by name, normalized CNIC, phone or room. Filter active, overdue, police-pending, checkout-pending and former residents.

Resident profile tabs:

- Overview
- Documents
- Payments
- Activity

Actions based on permission:

- call
- open WhatsApp using a safe deep link
- record payment
- send reminder
- move room
- update police status
- start checkout

### F. Monthly invoicing and payments

- Generate monthly rent invoices idempotently so rerunning cannot create duplicates.
- Allow configured due day.
- Support paid, unpaid, partial and overdue states.
- Record cash and external digital payments.
- Payment proofs enter a review queue.
- Approval must create/verify the payment, allocate it to the invoice and generate a receipt.
- Rejection requires a reason and keeps the amount outstanding.
- Requesting a clearer image must notify the resident without losing the submission history.
- Bulk-select overdue residents and open pre-filled WhatsApp reminders. For the MVP, use WhatsApp deep links; do not falsely claim that messages were delivered. Store `opened_for_sending` separately from any future verified delivery status.

### G. Receipt and PDF generation

Receipts must include:

- H-K Boys Hostel name and Lahore address placeholder
- receipt number
- resident name
- masked CNIC
- room and bed
- payment purpose and rent month
- payment method and reference
- rent, security and police-form lines
- total received and balance
- date/time and verifying manager

Provide protected on-screen preview, PDF download and WhatsApp sharing. Generate receipts on the server from trusted database values, never from client-submitted totals.

### H. Police-verification tracker

- Track every defined stage independently of payment.
- Show missing documents.
- Record prepared, submission and verification dates.
- Upload acknowledgement safely.
- Store police station/reference details.
- Preserve a status history.

### I. Checkout and security settlement

Guided flow:

1. intended leaving date
2. outstanding rent and charges
3. damage items and photographs
4. deductions with reasons
5. refundable deposit calculation
6. refund method/reference
7. manager confirmation and owner approval when required

Example calculation:

- deposit held: PKR 3,000
- unpaid rent: PKR 0
- damage deduction: PKR 500
- other charges: PKR 0
- refundable amount: PKR 2,500

Checkout completion must atomically close the allocation/admission, post deposit ledger entries, record refund details, generate a settlement receipt, make the bed vacant and retain history. Require owner approval if deductions exceed configured limits or the held deposit.

### J. Resident companion portal

Show only the authenticated resident's:

- room and bed
- current invoice and due date
- amount outstanding
- security-deposit ledger balance
- police status
- notices
- receipts and payment history

Allow payment-proof upload, contact updates and maintenance requests. Do not allow residents to alter authoritative allocation or financial fields.

### K. Configuration and audit

Allow the owner to configure:

- hostel identity and address
- floors, rooms, beds and room types
- rent, deposit, charges and due date
- payment instructions
- bed-hold duration
- receipt footer
- manager permissions

Audit sensitive actions including login, resident creation, protected document access, bed allocation/movement, payment approval/rejection/reversal, police-status changes and checkout settlement. Audit logs must be append-only to ordinary users.

## 10. PWA and offline behavior

Implement:

- valid web manifest
- installable icons and standalone display
- service worker
- offline shell and useful offline page
- online/offline indicator
- safe caching strategy that never caches protected CNIC images or private API responses in a shared/public cache
- IndexedDB draft saving for enquiry and admission forms
- explicit `Saved locally`, `Waiting to sync`, `Syncing`, `Synced` and `Sync failed` states

Do not permit offline finalization of payment approval, bed allocation, room movement or checkout. These operations require the server so database constraints and transactions can protect integrity.

Do not cache authentication tokens or sensitive resident data insecurely. Provide a `Clear local drafts` option on shared devices.

## 11. Validation and localization

Use shared Zod schemas on client and server where appropriate.

Validate:

- Pakistani CNIC/B-Form format and normalized 13 digits
- Pakistani mobile formats such as `03XXXXXXXXX` and `+923XXXXXXXXX`
- positive monetary amounts
- joining and checkout dates
- required resident, room and bed fields
- duplicate active CNIC
- upload types and size
- payment amount not exceeding allowed allocation without an explicit unapplied balance policy

Friendly validation messages should explain how to fix the field. Prepare translation keys so critical actions can show English with Urdu labels, but English is the initial complete locale.

## 12. Seed and demonstration data

Create an idempotent seed script with fictional data only:

- one owner
- two managers
- H-K Boys Hostel configuration
- 36 rooms and their beds
- a realistic mix of vacant, occupied, held and maintenance beds
- residents such as Ali Raza, Hamza Khan, Abdullah Ahmed, Bilal Hussain, Usman Tariq and Saad Ali
- current paid, partial, unpaid and overdue invoices
- three pending payment proofs
- six police-verification records requiring attention
- two upcoming checkouts
- several enquiries across the pipeline

Use clearly fictional CNICs, contact details and payment references. Include development-only demo credentials in the README, never in production seed or source defaults.

## 13. Required end-to-end journeys

Implement and test these journeys:

1. **Admit four-seater resident:** dashboard -> add resident -> complete form -> upload safe test documents -> select Room 101 Bed D -> calculate PKR 10,800 -> record verified cash payment -> confirm -> receipt -> bed becomes occupied.
2. **Admit three-seater resident with proof:** select vacant bed -> admission -> calculate PKR 12,300 -> upload payment proof -> admission/payment remains in appropriate review state without falsely marking paid.
3. **Approve payment proof:** open queue -> inspect -> approve -> transaction and invoice update -> receipt generated -> resident notification created.
4. **Handle rejected proof:** reject with reason -> invoice remains outstanding -> history retained -> resident sees correction request.
5. **Send overdue reminder:** payments -> overdue filter -> select residents -> preview -> open valid WhatsApp deep link -> record only the action actually performed.
6. **Convert enquiry:** enquiry -> matched bed -> time-limited hold -> admission with prefilled fields -> confirmed allocation.
7. **Move resident:** resident profile -> select new vacant bed -> atomic move -> previous bed vacant and new bed occupied -> audit history.
8. **Checkout:** resident -> checkout -> damage deduction -> deposit calculation -> approval if required -> settlement -> receipt -> bed becomes vacant and resident becomes former.
9. **Authorization:** resident cannot access another resident's URL or document; manager from one hostel cannot access another hostel's records.
10. **Race condition:** two concurrent attempts to claim one bed result in only one success and a clear conflict response for the other.

## 14. Testing requirements

Write meaningful tests, not snapshots alone.

Unit tests:

- rent/admission totals
- partial-payment calculations
- security-settlement calculation
- CNIC and mobile normalization
- status transitions
- permission helpers

Integration tests:

- admission transaction
- unique active bed allocation
- monthly invoice idempotency
- payment proof approval and rejection
- payment reversal
- checkout transaction
- tenant isolation
- protected document authorization

Playwright tests:

- the main owner/manager flows listed above
- mobile viewport
- basic desktop viewport
- login and unauthorized-route behavior

Add test fixtures that do not contain real personal data. Run:

- formatting check
- lint
- TypeScript type check
- unit/integration tests
- production build
- selected Playwright flows

The final handoff must report the exact commands and results.

## 15. Milestone order

Implement in this order:

### Milestone 1 — Foundation

Project scaffold, design system, Docker development services, PostgreSQL/Prisma, authentication, hostel membership, authorization, seed and health check.

### Milestone 2 — Inventory

Floors, room types, rooms, beds, dashboard occupancy and room/bed management.

### Milestone 3 — Admissions

Enquiries, resident and guardian records, protected documents, admission wizard, charge calculation and atomic bed allocation.

### Milestone 4 — Finance

Invoices, payment proofs, approval/rejection, partial payment, receipt numbers, server-generated PDFs and reminders.

### Milestone 5 — Compliance and checkout

Police tracker, security ledger, damage evidence, checkout settlement and bed release.

### Milestone 6 — Resident portal and PWA

Resident views, maintenance requests, installability, offline drafts, sync states and protected caching.

### Milestone 7 — Hardening and deployment

Authorization review, race-condition tests, security headers, rate limits, backups, restore documentation, production Compose and end-to-end verification.

Do not start a later milestone while the current milestone has type, lint, migration or test failures.

## 16. Definition of done

The MVP is complete only when:

- it runs locally from documented commands
- it deploys through Docker Compose on an Ubuntu server
- owner, manager and resident roles are enforced on the server
- all demo metrics come from PostgreSQL
- no two active residents can occupy one bed
- admissions, payment approvals and checkout are transactional
- CNIC and payment images are private
- receipts are generated from trusted server data
- verified financial history is not silently editable or deletable
- the PWA is installable and has a safe offline shell
- offline drafts are visible and do not silently overwrite server data
- core flows work at a mobile viewport
- migrations and seed are reproducible
- lint, types, tests and production build pass
- README explains setup, demo users, deployment, backup, restore and known limitations
- no core-flow buttons are dead
- no real CNICs, phone numbers or payment credentials appear in source control

## 17. Required final handoff

When implementation is complete, provide:

1. What was built by milestone
2. Repository structure
3. Architecture and security decisions
4. Database schema summary
5. Environment variables required
6. Local startup instructions
7. Production deployment instructions
8. Backup and restore instructions
9. Demo accounts and walkthroughs
10. Test/build commands and actual results
11. Known limitations
12. Recommended next production steps

Begin by inspecting the repository, then present the implementation plan and start Milestone 1.
