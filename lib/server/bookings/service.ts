// lib/server/bookings/service.ts
// Booking data-access layer. Pages and route handlers call these functions —
// never the database repository directly. Every function verifies the session
// itself ("verify close to the data"), even though callers also check.
//
// Writes:  validate (Zod) → business rules (version, archived, invoice number
//          and dates) → calculate → fits the bill → one atomic database write.
// The invoice number, invoice date and due date are assigned here, never
// taken from the client: INV_{year}{counter} from an atomic per-year counter,
// today (IST), and trip start − 14 days (re-worked out when the trip start changes).
// Every change carries the version (updatedAt) the user was looking at, and the
// write only happens if the booking is still at that version, so a stale
// screen can never silently overwrite someone else's newer save.

import "server-only";

import { cache } from "react";
import { getYear } from "date-fns";
import { z } from "zod";
import {
  bookingDraftSchema,
  bookingIdSchema,
  createBookingSchema,
  tripEndIssue,
  tripStartIssue,
  updateBookingSchema,
} from "@/lib/domain/booking.schema";
import { calculateBookingAmounts } from "@/lib/domain/calculations";
import { defaultDueDate, parseDDMMYYYY, todayIST } from "@/lib/domain/dates";
import type { BookingFilters } from "@/lib/domain/filters";
import { formatInvoiceNumber, nextSequence } from "@/lib/domain/invoice-number";
import type { Booking, BookingInput, BookingRef, BookingStatus } from "@/lib/domain/types";
import {
  checkDatabase,
  findBillBooking,
  findBooking,
  findByIdempotencyKey,
  findVersion,
  insertBooking,
  issueInvoiceSequence,
  ledgerPage,
  peekInvoiceSequence,
  setStatusIfVersion,
  updateBookingIfVersion,
  type DbHealth,
  type LedgerResult,
} from "../db/bookings-repo";
import { getEnv } from "../env";
import {
  BillUnavailableError,
  BookingArchivedError,
  BookingNotFoundError,
  BookingValidationError,
  MissingVersionError,
  StaleBookingError,
} from "../errors";
import { verifySession } from "../guards";
import type { BillBooking } from "../pdf/content";
import type { BillProblems } from "../pdf/layout";
import { BillDoesNotFitError, loadBillFitCheck, renderBillOfSupply } from "../pdf/render";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parses with a Zod schema or throws BookingValidationError (first message per field). */
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "form";
    fieldErrors[field] ??= issue.message;
  }
  throw new BookingValidationError(fieldErrors);
}

function assertBookingId(id: string): void {
  if (!bookingIdSchema.safeParse(id).success) throw new BookingNotFoundError();
}

/** The client must say which version it is changing. */
function assertVersionGiven(expectedUpdatedAt: string): void {
  if (!expectedUpdatedAt) throw new MissingVersionError();
}

/** The version the client saw must still be the stored one. */
function assertCurrentVersion(booking: Booking, expectedUpdatedAt: string): void {
  assertVersionGiven(expectedUpdatedAt);
  if (booking.updatedAt !== expectedUpdatedAt) throw new StaleBookingError();
}

/**
 * Every saved booking must print: a value that can't fit its field on the Bill
 * of Supply is refused here, at save time, with the field to shorten.
 */
function assertFitsBill(check: (booking: BillBooking) => BillProblems, booking: BillBooking): void {
  const problems = check(booking);
  if (Object.keys(problems).length > 0) throw new BookingValidationError(problems as Record<string, string>);
}

const yearOf = (ddmmyyyy: string) => getYear(parseDDMMYYYY(ddmmyyyy)!);

/** The trip must start and end after the invoice date. Only the dates given are checked. */
function assertTripDatesAllowed(dates: { tripStartDate?: string; tripEndDate?: string }, invoiceDate: string): void {
  const fieldErrors: Record<string, string> = {};
  const start = dates.tripStartDate === undefined ? null : tripStartIssue(dates.tripStartDate, invoiceDate);
  const end = dates.tripEndDate === undefined ? null : tripEndIssue(dates.tripEndDate, invoiceDate);
  if (start) fieldErrors.tripStartDate = start;
  if (end) fieldErrors.tripEndDate = end;
  if (start || end) throw new BookingValidationError(fieldErrors);
}

/** A timestamp guaranteed to differ from the previous version's (versions must change on every save). */
function nextTimestamp(previous: string): string {
  const now = new Date();
  const prev = Date.parse(previous);
  return (Number.isFinite(prev) && now.getTime() <= prev ? new Date(prev + 1) : now).toISOString();
}

/**
 * Writes `updated` only if the booking is still at `expectedUpdatedAt`.
 * When nothing was written, works out why: gone (404) or changed (412).
 */
async function writeIfUnchanged(updated: Booking, expectedUpdatedAt: string): Promise<Booking> {
  if (await updateBookingIfVersion(updated, expectedUpdatedAt)) return updated;
  if ((await findVersion(updated.bookingId)) === null) throw new BookingNotFoundError();
  throw new StaleBookingError();
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The dashboard: one page of bookings for the filters, the count and totals
 * of every match, the summary tiles and the destination list.
 */
export async function getLedger(filters: BookingFilters): Promise<LedgerResult> {
  await verifySession();
  return ledgerPage(filters, todayIST());
}

/**
 * One booking by its UUID. Throws BookingNotFoundError.
 * Cached per render, so components of one page that ask for the same booking
 * share a single read.
 */
export const getBooking = cache(async (id: string): Promise<Booking> => {
  await verifySession();
  assertBookingId(id);

  const booking = await findBooking(id);
  if (!booking) throw new BookingNotFoundError();
  return booking;
});

/**
 * The Bill of Supply PDF, drawn from the latest saved booking. Archived
 * bookings have none until restored.
 */
export async function getBillOfSupply(id: string): Promise<{ pdf: Uint8Array; invoiceNumber: string }> {
  await verifySession();
  assertBookingId(id);
  const booking = await findBillBooking(id); // only what the bill prints
  if (!booking) throw new BookingNotFoundError();
  if (booking.bookingStatus === "Archived") throw new BillUnavailableError();
  try {
    return { pdf: await renderBillOfSupply(booking), invoiceNumber: booking.invoiceNumber };
  } catch (err) {
    // A booking edited outside the app can hold values the bill can't fit
    if (err instanceof BillDoesNotFitError) throw new BookingValidationError(err.problems as Record<string, string>);
    throw err;
  }
}

/**
 * The invoice number a booking saved now would most likely get. Shown on the
 * new-booking form; the number is assigned on save.
 */
export async function suggestInvoiceNumber(): Promise<string> {
  await verifySession();
  const year = yearOf(todayIST());
  return formatInvoiceNumber(year, nextSequence(await peekInvoiceSequence(year), getEnv().INITIAL_INVOICE_NUMBER));
}

/** Database connectivity for /api/health (the route has checked the session). */
export function checkDatabaseHealth(): Promise<DbHealth> {
  return checkDatabase();
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Creates in flight on this server instance, by idempotency key. */
const createsInFlight = new Map<string, Promise<Booking>>();

/**
 * Creates a booking with the next invoice number, today's invoice date and the
 * default due date. Repeats with the same idempotency key (double submit,
 * retry) return the first booking instead of creating another: a repeat that
 * arrives while the first is still saving waits for it (so it never takes an
 * invoice number of its own), and the database's unique key on idempotencyKey
 * covers repeats that reach another server instance.
 */
export async function createBooking(input: unknown, idempotencyKey?: string): Promise<Booking> {
  await verifySession();
  if (!idempotencyKey) return createNewBooking(input);

  const inFlight = createsInFlight.get(idempotencyKey);
  if (inFlight) return inFlight;
  const created = createNewBooking(input, idempotencyKey).finally(() => createsInFlight.delete(idempotencyKey));
  createsInFlight.set(idempotencyKey, created);
  return created;
}

async function createNewBooking(input: unknown, idempotencyKey?: string): Promise<Booking> {
  // Email is optional: a create without the key means "no email"
  const draft = validate(
    bookingDraftSchema,
    input && typeof input === "object" && !("customerEmail" in input) ? { ...input, customerEmail: "" } : input
  );
  const invoiceDate = todayIST();
  assertTripDatesAllowed(draft, invoiceDate);

  const [earlier, fitsBill] = await Promise.all([
    idempotencyKey ? findByIdempotencyKey(idempotencyKey) : null,
    loadBillFitCheck(),
  ]);
  if (earlier) return earlier;

  // Everything is checked before a number is taken, so a refused booking never uses one up
  const year = yearOf(invoiceDate);
  const dueDate = defaultDueDate(draft.tripStartDate, invoiceDate);
  const longestNumber = formatInvoiceNumber(year, 99_999);
  const checked = validate(createBookingSchema, { ...draft, invoiceNumber: longestNumber, invoiceDate, dueDate });
  assertFitsBill(fitsBill, { ...checked, ...calculateBookingAmounts(checked) });

  const sequence = await issueInvoiceSequence(year, getEnv().INITIAL_INVOICE_NUMBER);
  const data: BookingInput = { ...checked, invoiceNumber: formatInvoiceNumber(year, sequence) };

  const now = new Date().toISOString();
  const booking: Booking = {
    ...data,
    ...calculateBookingAmounts(data),
    bookingId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    bookingStatus: "Active",
  };
  return insertBooking(booking, idempotencyKey);
}

/**
 * Updates a booking. The change is merged onto the stored record and the
 * whole result is re-validated, so cross-field rules always hold.
 * `expectedUpdatedAt` is the version the user edited (sent as X-Booking-Version).
 */
export async function updateBooking(id: string, input: unknown, expectedUpdatedAt: string): Promise<Booking> {
  await verifySession();
  assertBookingId(id);
  const changes = validate(updateBookingSchema, input);

  const [booking, fitsBill] = await Promise.all([findBooking(id), loadBillFitCheck()]);
  if (!booking) throw new BookingNotFoundError(); // before the version: an unknown booking is 404, not 428
  assertCurrentVersion(booking, expectedUpdatedAt);
  if (booking.bookingStatus === "Archived") throw new BookingArchivedError();

  // The invoice number and date never change. A changed trip start or end
  // must come after the invoice date; a new start moves the due date.
  const merged: BookingInput = { ...booking, ...changes };
  const changed = (key: "tripStartDate" | "tripEndDate") =>
    changes[key] !== undefined && changes[key] !== booking[key] ? changes[key] : undefined;
  assertTripDatesAllowed({ tripStartDate: changed("tripStartDate"), tripEndDate: changed("tripEndDate") }, booking.invoiceDate);
  if (changed("tripStartDate") !== undefined) {
    merged.dueDate = defaultDueDate(merged.tripStartDate, booking.invoiceDate);
  }
  const data = validate(createBookingSchema, merged);

  const updated: Booking = {
    ...booking,
    ...data,
    ...calculateBookingAmounts(data),
    updatedAt: nextTimestamp(booking.updatedAt),
  };
  assertFitsBill(fitsBill, updated);
  return writeIfUnchanged(updated, expectedUpdatedAt);
}

/**
 * Sets the booking status (Active / Cancelled / Archived). Archiving is a
 * soft delete; setting Active on an archived booking restores it.
 */
export async function setBookingStatus(id: string, status: BookingStatus, expectedUpdatedAt: string): Promise<BookingRef> {
  await verifySession();
  assertBookingId(id);
  if (!expectedUpdatedAt) {
    // An unknown booking is 404 before a missing version is 428
    if ((await findVersion(id)) === null) throw new BookingNotFoundError();
    throw new MissingVersionError();
  }

  // One atomic call when everything is in order; the rules ride in the filter
  const cannotFromArchived = status === "Cancelled";
  const saved = await setStatusIfVersion(
    id,
    expectedUpdatedAt,
    status,
    nextTimestamp(expectedUpdatedAt),
    cannotFromArchived ? { bookingStatus: { $ne: "Archived" } } : {}
  );
  if (saved) return saved;

  // Nothing changed: say why
  const version = await findVersion(id);
  if (version === null) throw new BookingNotFoundError();
  if (version !== expectedUpdatedAt) throw new StaleBookingError();
  throw new BookingArchivedError();
}

/** Soft-deletes a booking. It stays in the database and can be restored. */
export function archiveBooking(id: string, expectedUpdatedAt: string): Promise<BookingRef> {
  return setBookingStatus(id, "Archived", expectedUpdatedAt);
}
