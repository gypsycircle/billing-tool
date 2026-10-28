# GypsyCircle Billing Tool

Private billing and invoice management tool for GypsyCircle travel packages.

> **Access is restricted.** This tool is for internal use only. There is no public registration.

---

## Quick Start

### Prerequisites

- Node.js 20+
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
```

Open [http://localhost:3000](http://localhost:3000): the access-code screen.

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

# End-to-end booking flows against the real cluster, in a throwaway database
# ("gypsycircle_billing_e2e" — emptied and dropped by the script; the real database is never touched):
MONGODB_DB=gypsycircle_billing_e2e npm run dev   # terminal 1
npm run test:e2e                                 # terminal 2
```

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
  (protected)/     — Protected route group (all require a session)
    bookings/      — Dashboard: summary figures, filters, ledger table
      new/         — New booking form
      [id]/        — Booking detail (laid out like the bill)
      [id]/edit/   — Edit booking
  api/
    auth/
      login/       — POST: validate code, issue session cookie
      logout/      — POST: clear session cookie
    bookings/      — GET: one ledger page (same filters as the dashboard), or ?view=search&q= for ⌘K · POST: create (Idempotency-Key)
    bookings/[id]/ — GET · PATCH: edit, or {bookingStatus} to cancel/reactivate/restore · DELETE: archive
                     (writes return only { bookingId, invoiceNumber, updatedAt, bookingStatus })
    bookings/[id]/pdf/ — GET: Bill of Supply PDF (?inline=1 to open in the browser)
    health/        — GET: database connectivity and whether an access code is set (requires session)
components/
  ui/              — shadcn primitives (Base UI)
  shared/          — Page header, empty state, money, status badge, stats
  layout/          — App header, navigation, command menu (⌘K or /), theme toggle
  brand/           — Logo mark and decorative route motif
  auth/            — Logout button
  bookings/        — Ledger table, filters, booking form, bill-style document, archive dialog
hooks/             — Form, filters, mutations, status actions, hotkeys, logout, countdown
lib/
  domain/          — Pure booking logic shared by browser and server:
                     types, Zod schemas, calculations, money, words, dates, invoice numbers
  server/          — Server-only code:
    env.ts           Validated configuration
    guards.ts        Session checks for pages and services
    errors.ts        Typed service errors
    session/         JWT token, cookies, access-code hash check
    http/            JSON responses, withApiRoute wrapper
    security/        Same-origin, body size, rate limit, client IP
    db/              MongoDB client, collections and indexes, repository, ledger queries
    bookings/        Booking service (business rules on top of the repository)
  client/          — Browser fetch helper with global 401 handling
  utils.ts         — cn() for shadcn/ui
proxy.ts           — Layer 1: optimistic session check, HTTPS redirect
instrumentation.ts — Validates configuration at server start, warms up the database
vercel.json        — Runs the functions in Mumbai (bom1), next to the database
tests/stubs/       — Test stand-ins (server-only)
private-templates/ — Bill fonts and images (NOT served as static files)
```

`docs/` (runbook, plans) and `scripts/` (the security and e2e suites behind
`npm run test:auth` / `test:e2e`, and the PDF asset tools) are kept on the
maintainer's machine and are not in the repository, so those two npm scripts
only work there.

---

## Build Phases

See [`docs/master-plan-v2.md`](docs/master-plan-v2.md) for the full plan. Each phase gets its own detailed `docs/phase-*.md` before it is built.

| Phase | Status | Scope |
|:---|:---:|:---|
| Phase 0 | ✅ Done* | Repo hygiene: docs/ kept out of git, access code set (*delete the old Google service-account key; Sheets is no longer used) |
| Phase 1R | ✅ Done | Foundation revamp: `lib/domain` + `lib/server` structure, env validation, row validation, Vitest |
| Phase 2R | ✅ Done | Security revamp: strict nonce CSP, redirect/origin/IP fixes, shared login rate limiting, patched Next.js |
| Phase 3 | ✅ Done | "Ledger & Ink" design system, access page, app shell, dashboard summary |
| Phase 4 | ✅ Done | Booking CRUD API + ledger table with filters, booking form with live receipt, bill-style detail view, archive/restore |
| Phase 5 | ✅ Done | Bill of Supply PDF: one A4 page drawn like the on-screen bill (Geist + Fraunces), kerned text, one-page fit check at save |
| Storage | ✅ Done | MongoDB Atlas replaces Google Sheets: indexed queries, atomic invoice counter, versioned writes |
| Phase 6 | 🔜 | Vercel deployment (Mumbai) and production checks: see Deploying below |

---

## Security Notes

- **No public registration** — one shared access code for V1
- **Two-layer protection**: `proxy.ts` (optimistic) + authoritative check in every page/API handler and the booking service
- **Strict Content-Security-Policy**: a fresh nonce per request; only the app's own scripts can run
- **Rate limiting**: 5 wrong attempts per IP per 15 min; 40 global per 15 min (stored in MongoDB, so shared by every server instance); client IP is taken only from headers the host sets, never from `X-Forwarded-For`
- **CSRF protection**: SameSite=Lax cookie + Origin checked against `APP_URL` + `Sec-Fetch-Site` + JSON-only
- **Safe redirects**: the post-login `next` path is validated on the server and in the browser
- **No caching**: pages and API responses are `Cache-Control: private, no-store`
- **Private template files** are never served as static assets — only via the authenticated PDF route
- **Session secret rotation** invalidates all active sessions immediately
- See `docs/security-runbook.md` for full operational guidance
