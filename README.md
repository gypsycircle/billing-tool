# GypsyCircle Billing Tool

Private billing and invoice management tool for GypsyCircle travel packages.

> **Access is restricted.** This tool is for internal use only. There is no public registration.

---

## Quick Start

### Prerequisites

- Node.js 22 (`engines` in `package.json`; Vercel uses 22.x)
- A MongoDB Atlas cluster (Mumbai, `ap-south-1`) and a database user with `readWrite` on the app's database
- A configured `.env.local` with the variables listed below (env files are never committed)

### Setup

```bash
# Install dependencies
npm install

# Create .env.local with the variables listed under Environment Variables

# Set the access code (asked for with hidden typing; stored only as a hash)
node --env-file=.env.local scripts/set-access-code.mjs

# Start the development server
npm run dev

# Once the app has started on a database: fill the dropdown lists from the bookings already there
# (plus "Meta Ads"); --dry-run first shows what it would add
node --env-file=.env.local scripts/seed-general.mjs
```

Open [http://localhost:3000](http://localhost:3000): the access-code screen. After signing in you land on Bookings. Add the team, and any destinations, packages, routes and marketing channels the seed didn't, in **Settings**: the booking and expense forms pick from them.

---

## What's in the app

Three screens, in the top navigation (and in the ⌘K / `/` command menu):

- **Bookings** (`/bookings`): the ledger, with summary figures, search and filters (including **trip date**: a dropdown of quick picks like "Next month", or **Custom range** on a calendar), a pager, and **New booking** (key **B**). Each booking has a page laid out like its bill, an edit form, cancel / reactivate, archive / restore, and the Bill of Supply PDF (key **D** on a booking's page). **Package, Destination and Route are picked from the Settings lists** (Route is optional). A booking keeps the name as it was saved, so renaming or archiving a list item never changes an issued bill; editing an older booking whose value has left the list shows it marked "Not in the list", and it saves unchanged.
- **Expenses** (`/expenses`): the Direct and Indirect totals, filters (kind, type, who was paid, an **expense date** range, archived), the list with each expense's status, and **Add expense** (key **E**). Types: Package cost and Wages are **direct**; Marketing, Salary and Miscellaneous are **indirect**. Each expense has a page, an edit form, and archive / restore. **Every expense says where the money went ("Paid for")**, depending on its type:

  | Type | Paid for |
  |:---|:---|
  | Salary | a team member (from Settings) |
  | Package cost | a package (from Settings) |
  | Marketing | a channel (from Settings, e.g. Meta Ads), or **Other** with a short description |
  | Wages | typed, e.g. "Guide expense" |
  | Miscellaneous | typed |

  It's required, shown in the list and on the expense's page, and kept as it was saved (a later rename doesn't change it). Expenses saved before this ask for it on their next edit.
- **Settings** (`/settings`): the **Team** (the people salaries are paid to and who close bookings: name, role, phone; they don't sign in) and the **Lists** behind the dropdowns (Destinations, Packages, Routes, Marketing channels), five to a page. The team is newest first, with a search (name, role, phone); the lists are by name. Each shows its active ones, or with **Show archived … only** under **Filters** its archived ones (Reset goes back). Add (keys **T** and **L**), edit or rename, archive and restore. Names are unique (ignoring case and extra spaces) within the team and within each list. Archived ones leave the dropdowns but stay on everything already saved.

Every change to a booking's amount paid is recorded with its date (the payments record), which is how cash collected is counted. Edits are safe with several people at once: a save made from an outdated screen is refused rather than overwriting someone else's change.

---

## Environment Variables

Set these in `.env.local` locally, and in the Vercel project's environment variables in production:

| Variable | Description | Example |
|:---|:---|:---|
| `SESSION_SECRET` | JWT signing secret (≥32 chars, random) | `openssl rand -base64 32` |
| `MONGODB_URI` | MongoDB Atlas connection string (Atlas → Connect → Drivers) | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` |
| `MONGODB_DB` | Database name (optional) | `gypsycircle_billing` (default) |
| `INITIAL_INVOICE_NUMBER` | Where the invoice counter starts each year (`INV_{year}0143`) | `143` |
| `APP_URL` | Public origin of the app — required in production | `https://billing.example.com` |

**Generate a secure `SESSION_SECRET`:**
```bash
openssl rand -base64 32
```

**Never prefix secrets with `NEXT_PUBLIC_`** — they would be exposed to the browser.

---

## Authentication

- Open the app → the access-code screen at `/`
- Enter the access code → signed JWT cookie (HttpOnly, SameSite=Lax, 12-hour expiry)
- All pages and API routes verify the session independently
- The access code is **not** an environment variable. Only a salted scrypt hash
  is stored, in the database's `settings` collection (`hashedAccessCode`). Set
  or change it with `node --env-file=.env.local scripts/set-access-code.mjs`;
  the new code works on the next sign-in. Existing sessions stay valid until
  they expire; change `SESSION_SECRET` to sign everyone out.

See `docs/security-runbook.md` for how to change the access code, rotate secrets, and recover from lockouts.

---

## Development Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Build for production
npm run start      # Start production build
npm run lint       # Run ESLint
npm test           # Run unit tests (Vitest)
npm run test:auth  # Security test matrix (run it against a server on the throwaway database below:
                   # it stores a one-off access code there and trips the login lockout on purpose)

# End-to-end booking, payment and expense flows against the real cluster, in a throwaway database
# ("gypsycircle_billing_e2e" — emptied and dropped by the script; the real database is never touched):
MONGODB_DB=gypsycircle_billing_e2e npm run dev   # terminal 1
npm run test:e2e                                 # terminal 2
```

---

## Installing the app (PWA)

The billing tool installs like an app, with its own window and a home-screen icon:
- **Chrome / Edge (Mac, Windows, Android):** the install icon in the address bar, or ⌘K → **Install app**.
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**. Sign in once inside the installed app; it keeps its own sign-in, separate from Safari.

Nothing is stored on the device. Bookings always load from the server, and with no connection the app shows a "You're offline" screen. Updates arrive with every deploy, with no reinstall.

---

## Deploying (Vercel)

- Vercel builds and deploys **`main` only**; preview deployments are off (`vercel.json`), so no preview can touch the real database. Functions run in Mumbai (`bom1`), next to the Atlas cluster. Node 22.
- Environment variables (**Production only**):
  - `SESSION_SECRET`: a new value, not the local one;
  - `MONGODB_URI`: a production Atlas user with `readWrite` on the production database only;
  - `MONGODB_DB=gypsycircle_billing_prod` (local `.env.local` keeps the default `gypsycircle_billing` as the dev database), `INITIAL_INVOICE_NUMBER`;
  - `APP_URL`: the exact live address.
- The access code lives in each database (hashed); set it for production with `MONGODB_DB=gypsycircle_billing_prod node --env-file=.env.local scripts/set-access-code.mjs`. Nothing to set for it in Vercel.
- Atlas Network Access must allow Vercel (`0.0.0.0/0`, or the Vercel–Atlas integration).
- **Once, after the first deploy with the Settings lists:** fill the lists from the destinations, packages and routes your bookings already use, plus the marketing channel "Meta Ads", so the booking form's dropdowns aren't empty. Add the team in Settings. Dry run first; it is safe to run again:
  ```bash
  MONGODB_DB=gypsycircle_billing_prod node --env-file=.env.local scripts/seed-general.mjs --dry-run
  MONGODB_DB=gypsycircle_billing_prod node --env-file=.env.local scripts/seed-general.mjs
  ```
- **Once, after the first deploy with the payments record:** open the live app (it creates the `payments` collection), then give bookings saved before it the payment entries they're missing (including the rest of any booking edited before you ran this), so they count in Cash collected. Dry run first, then the real run; it is safe to run again:
  ```bash
  MONGODB_DB=gypsycircle_billing_prod node --env-file=.env.local scripts/backfill-payments.mjs --dry-run
  MONGODB_DB=gypsycircle_billing_prod node --env-file=.env.local scripts/backfill-payments.mjs
  ```
- After a deploy:
  - sign in, then open `/api/health` (it should say `healthy` and `accessCodeSet: true`);
  - download one bill;
  - run `ACCESS_CODE=… BASE_URL=https://… npm run test:auth`. Run it last: it locks your IP out of sign-in for 15 minutes.
  - Never run `test:e2e` against production.

---

## Project Structure

```
app/
  page.tsx         — Access-code screen at / (public)
  (protected)/     — Protected route group (all require a session); every page has a loading.tsx outline
    bookings/      — Bookings ledger: summary figures, filters, table, pager
      new/         — New booking form
      [id]/        — Booking detail (laid out like the bill)
      [id]/edit/   — Edit booking
    expenses/      — Expenses list: Direct / Indirect totals, filters, table, pager
      new/         — Add expense form
      [id]/        — Expense detail
      [id]/edit/   — Edit expense
    settings/      — Team and lists (paged; add, edit, archive in dialogs)
  manifest.ts      — Web app manifest (installable app)
  sw.js/           — Service worker (offline page only, caches nothing)
  api/
    auth/
      login/       — POST {code}: start a session (401 wrong code, 422 malformed body, 429 too many tries)
      logout/      — POST: clear session cookie
    bookings/      — GET: one ledger page (the ledger's filters, incl. from/to on trip start) · POST: create (Idempotency-Key)
    bookings/[id]/ — GET · PATCH: edit, or {bookingStatus} to cancel/reactivate/restore · DELETE: archive
                     (writes return only { bookingId, invoiceNumber, updatedAt, bookingStatus })
    bookings/[id]/pdf/ — GET: Bill of Supply PDF (?inline=1 to open in the browser)
    expenses/      — GET: one list page (kind, type, paidFor, from/to, archived, page) · POST: create (Idempotency-Key)
    expenses/[id]/ — GET · PATCH: edit, or {status: "Active"} to restore · DELETE: archive
    team/          — GET: every team member ({ items }) · POST: add (Idempotency-Key)
    team/[id]/     — GET · PATCH: edit, or {status: "Active"} to restore · DELETE: archive
    general/       — GET ?kind=destination|package|route|marketing: one list · POST: add (Idempotency-Key)
    general/[id]/  — GET · PATCH: rename, or {status: "Active"} to restore · DELETE: archive
    health/        — GET: database connectivity and whether an access code is set (requires session)
components/
  ui/              — shadcn primitives (Base UI), including calendar and popover
  shared/          — Shared building blocks: page header, stats, money, status badge, table frame,
                     record list, filter toolbar, select, date pickers, pager, record menus and pages,
                     archive dialog, empty states, page skeletons
  forms/           — Form layout, fields, sections, summary card and submit button shared by every form
  layout/          — App header, navigation, command menu (⌘K or /), theme toggle
  brand/           — Logo mark, app icons
  pwa/             — Service-worker registration
  auth/            — Logout button
  bookings/        — Ledger table, filters, booking form, bill-style document, status actions
  expenses/        — Expense table, filters, expense form (with its paid-for field), expense document
  settings/        — Team and lists sections, record dialog, row menu
hooks/             — Forms and saving, URL filters, record actions, hotkeys, logout, countdown
lib/
  domain/          — Pure logic shared by browser and server: types, Zod schemas, calculations,
                     money, words, dates, invoice numbers, filters, expenses
  server/          — Server-only code:
    env.ts           Validated configuration
    guards.ts        Session checks for pages and services
    errors.ts        Typed service errors (per record: booking, expense, team member, list item)
    session/         JWT token, cookies, access-code hash check
    http/            JSON responses, withApiRoute wrapper, record versions and idempotency keys
    security/        Same-origin, body size, rate limit, client IP
    records/         Rules shared by every record (validation, versions, one create per key), and the
                     service shared by team members and list items
    db/              MongoDB client, collections and indexes, transactions, repositories and queries
                     (bookings, payments, expenses, team and lists)
    bookings/        Booking service (business rules on top of the repository)
    expenses/        Expense service (checks "paid for" against its list)
    team/, general/  Team and lists services
    pdf/             Bill of Supply PDF layout and rendering
  client/          — Browser fetch helper with global 401 handling, changed-field diff
  utils.ts         — cn() for shadcn/ui
proxy.ts           — Layer 1: optimistic session check, HTTPS redirect, nonce CSP
instrumentation.ts — Validates configuration at server start, warms up the database (not on Vercel)
vercel.json        — Runs the functions in Mumbai (bom1), next to the database; deploys main only
tests/stubs/       — Test stand-ins (server-only)
private-templates/ — Bill fonts and images (NOT served as static files)
```

`docs/` (runbook, plans) and `scripts/` (the security and e2e suites behind
`npm run test:auth` / `test:e2e`, and the PDF asset tools) are kept on the
maintainer's machine and are not in the repository, so those two npm scripts
only work there.

---

## Build Phases

Four plans, all complete: [`docs/master-plan-v2.md`](docs/master-plan-v2.md) (the revamp, bookings, the PDF and the deploy), [`docs/master-plan-v3.md`](docs/master-plan-v3.md) (Expenses), [`docs/master-plan-v4.md`](docs/master-plan-v4.md) (where expense money went, the team, the dropdown lists and Settings) and [`docs/master-plan-v5.md`](docs/master-plan-v5.md) (form fixes, a paid-for filter, and one structure for every API route, form, list and record page).

| Phase | Status | Scope |
|:---|:---:|:---|
| **Plan v2** | | |
| Phase 0 | ✅ Done* | Repo hygiene: docs/ kept out of git, access code set (*delete the old Google service-account key; Sheets is no longer used) |
| Phase 1R | ✅ Done | Foundation revamp: `lib/domain` + `lib/server` structure, env validation, row validation, Vitest |
| Phase 2R | ✅ Done | Security revamp: strict nonce CSP, redirect/origin/IP fixes, shared login rate limiting, patched Next.js |
| Phase 3 | ✅ Done | "Ledger & Ink" design system, access page, app shell, ledger summary figures |
| Phase 4 | ✅ Done | Booking CRUD API + ledger table with filters, booking form with live receipt, bill-style detail view, archive/restore |
| Phase 5 | ✅ Done | Bill of Supply PDF: one A4 page drawn like the on-screen bill (Geist + Fraunces), kerned text, one-page fit check at save |
| Storage | ✅ Done | MongoDB Atlas replaces Google Sheets: indexed queries, atomic invoice counter, versioned writes |
| Phase 6 | ✅ Done | Vercel deployment (Mumbai) and production checks: see Deploying above |
| PWA | ✅ Done | Installable app: manifest, icons, offline page (nothing cached) |
| **Plan v3** | | |
| 1 | ✅ Done | Shared building blocks: forms, lists, record actions, versioning and numbering reused by every record |
| 2 | ✅ Done | Payments record (each change to amount paid, dated, in one transaction with the booking) and the Expenses data and API |
| 3 | ✅ Done | Expenses screens: list with Direct / Indirect totals, filters, add, edit, open, archive / restore |
| 6 | ✅ Done | Docs and final checks |
| **Plan v4** | | |
| A | ✅ Done | Data and API: team (`users`) and lists (`general`) collections, an expense's "paid for", bookings checked against the lists, the seed script |
| B | ✅ Done | Settings page: team and lists, add / edit / archive in dialogs, five to a page |
| C | ✅ Done | Expense screens: "Paid for" per type in the form, the list and the expense's page |
| D | ✅ Done | Booking form: Package, Destination and Route from the lists |
| E | ✅ Done | Docs and full checks |
| **Plan v5** | | |
| 1 | ✅ Done | Fixes: expense page sizes, "Paid for" errors shown with the rest, checks only on Submit, a paid-for filter on Expenses |
| 2 | ✅ Done | One API structure: every route a thin controller over one service call; login answers 422 for a malformed body |
| 3 | ✅ Done | One shared piece per UI and hook pattern (forms, lists, record pages, actions, selects, paths, shortcuts) |
| Extras | ✅ Done | Settings search and archived views; the expense page laid out like a bill; archive stays on the page; shadcn date pickers and date filters; Status on expenses; one badge palette |
| 4 | ✅ Done | Docs and full checks |

---

## Security Notes

- **No public registration** — one shared access code for V1
- **Two-layer protection**: `proxy.ts` (optimistic) + authoritative check in every page/API handler and the booking service
- **Strict Content-Security-Policy**: a fresh nonce per request; only the app's own scripts can run
- **Rate limiting**: 5 wrong attempts per IP per 15 min; 40 global per 15 min, counting only attempts a client's own limit lets through, so one IP can't lock everyone out (stored in MongoDB, so shared by every server instance); client IP is taken only from headers the host sets, never from `X-Forwarded-For`
- **CSRF protection**: SameSite=Lax cookie + Origin checked against `APP_URL` + `Sec-Fetch-Site` + JSON-only
- **Safe redirects**: the post-login `next` path is validated on the server and in the browser
- **No caching**: pages and API responses are `Cache-Control: private, no-store`
- **Private template files** are never served as static assets — only via the authenticated PDF route
- **Session secret rotation** invalidates all active sessions immediately
- See `docs/security-runbook.md` for full operational guidance
