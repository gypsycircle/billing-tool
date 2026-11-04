// lib/server/bookings/service.ts
// Booking data-access layer. Pages and route handlers call these functions —
// never the database repository directly. Every function verifies the session
// itself ("verify close to the data"), even though callers also check.
//
// Writes:  validate (Zod) → business rules (version, archived, invoice number
//          and dates, destination / package / route from their lists) →
//          calculate → fits the bill → one atomic database write.
// The invoice number and due date are assigned here, never taken from the
// client: INV_{year}{counter} from an atomic per-year counter, and trip start
// − 14 days (re-worked out when the trip start changes). The invoice date is
// picked on create (today, yesterday or the day before, IST) and never changes.
// Every change carries the version (updatedAt) the user was looking at, and the
// write only happens if the booking is still at that version, so a stale
// screen can never silently overwrite someone else's newer save.

import "server-only";

import { cache } from "react";
import type { z } from "zod";
import { getYear } from "date-fns";
import {
  bookingDraftSchema,
  bookingIdSchema,
  createBookingSchema,
  invoiceDateChoices,
  invoiceDateIssue,
  refundChangeSchema,
  statusChangeSchema,
  tripEndIssue,
  tripStartIssue,
  updateBookingSchema,
} from "@/lib/domain/booking.schema";
import { bookingHistory, historyChanged, isCancelledEvent, type HistoryEvent, type HistoryRow } from "@/lib/domain/booking-history";
import { calculateBookingAmounts } from "@/lib/domain/calculations";
import { defaultDueDate, parseDDMMYYYY, toISODate, todayIST } from "@/lib/domain/dates";
import { PAGE_SIZE, type BookingFilters, type PageInfo } from "@/lib/domain/filters";
import {
  BOOKING_LIST_FIELD_IDS as LIST_FIELD_IDS,
  BOOKING_LIST_FIELDS as LIST_FIELDS,
  GENERAL_KINDS,
  ROUTE_OTHER,
  type BookingListField as ListField,
  type BookingListOptions,
} from "@/lib/domain/general";
import { formatInvoiceNumber, nextSequence } from "@/lib/domain/invoice-number";
import { formatAmount } from "@/lib/domain/money";
import { nameKeyOf } from "@/lib/domain/named-records";
import { isArchived } from "@/lib/domain/records";
import { cancellationOf, refundQuote } from "@/lib/domain/refunds";
import type { Booking, BookingInput, BookingRef, BookingStatus, ClosedBy } from "@/lib/domain/types";
import {
  findBillBooking,
  findBooking,
  findByIdempotencyKey,
  findVersion,
  insertBooking,
  ledgerPage,
  updateBookingIfVersion,
  type LedgerResult,
} from "../db/bookings-repo";
import type { BookingHistoryDoc, PaymentDoc } from "../db/collections";
import { issueSequence, peekSequence } from "../db/counters-repo";
import { findHistory, findHistoryBill, historyEntry } from "../db/history-repo";
import { paymentEntry } from "../db/payments-repo";
import { teamRepo } from "../db/team-repo";
import { getEnv } from "../env";
import { clampPage } from "../db/paging";
import { hasRole, SALES_ROLE } from "@/lib/domain/team";
import { ArchivedRecordError, BillUnavailableError, BookingRuleError, NotFoundError, ValidationError } from "../errors";
import { activeListNames, getGeneralOptions } from "../general/service";
import { verifySession } from "../guards";
import { assertCurrentVersion, assertRecordId, assertVersionFor, nextTimestamp, notWritten, onePerKey, statusOrEdit, validate } from "../records/rules";
import type { BillBooking } from "../pdf/content";
import type { BillProblems } from "../pdf/layout";
import { BillDoesNotFitError, loadBillFitCheck, renderBillOfSupply } from "../pdf/render";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const assertBookingId = (id: string) => assertRecordId("booking", bookingIdSchema, id);

/** What a refund was worked out from, so it can't change while cancelled. */
const CANCELLED_LOCKED = ["travellers", "ratePerPerson", "discountAmount", "amountPaid", "slotAmount"] as const;

/**
 * Every saved booking must print: a value that can't fit its field on the Bill
 * of Supply is refused here, at save time, with the field to shorten.
 */
function assertFitsBill(check: (booking: BillBooking, before?: BillBooking) => BillProblems, booking: BillBooking, before?: BillBooking): void {
  const problems = check(booking, before);
  if (Object.keys(problems).length > 0) throw new ValidationError(problems as Record<string, string>);
}

const yearOf = (ddmmyyyy: string) => getYear(parseDDMMYYYY(ddmmyyyy)!);

/** The trip must start and end after the invoice date. Only the dates given are checked. */
function assertTripDatesAllowed(dates: { tripStartDate?: string; tripEndDate?: string }, invoiceDate: string): void {
  const fieldErrors: Record<string, string> = {};
  const start = dates.tripStartDate === undefined ? null : tripStartIssue(dates.tripStartDate, invoiceDate);
  const end = dates.tripEndDate === undefined ? null : tripEndIssue(dates.tripEndDate, invoiceDate);
  if (start) fieldErrors.tripStartDate = start;
  if (end) fieldErrors.tripEndDate = end;
  if (start || end) throw new ValidationError(fieldErrors);
}

/**
 * Destination, package and route must be active items of their lists; the
 * list's own spelling is what gets stored. Only the fields given are checked,
 * and an empty route is fine (it's optional).
 */
async function fromLists({ routeOther, ...values }: Partial<Record<ListField, string>> & { routeOther?: string }): Promise<Partial<Record<ListField, string>>> {
  // "Other": the route typed in stands, with no list to check, and the list stays as it is
  const typedRoute = values.routeDescription === ROUTE_OTHER;
  const given = LIST_FIELD_IDS.filter((field) => values[field] && !(typedRoute && field === "routeDescription"));
  const names = await activeListNames(Object.fromEntries(given.map((field) => [LIST_FIELDS[field], values[field]])));
  const fieldErrors: Record<string, string> = {};
  const matched: Partial<Record<ListField, string>> = { ...values, ...(typedRoute && { routeDescription: routeOther ?? "" }) };
  for (const field of given) {
    const kind = LIST_FIELDS[field];
    if (names[kind]) matched[field] = names[kind];
    else fieldErrors[field] = field === "routeDescription" ? "Pick a route from the list, or choose Other." : `Pick a ${GENERAL_KINDS[kind].one} from the list (add new ones in Settings).`;
  }
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(fieldErrors);
  return matched;
}

/** Who closed the booking: an active team member with the Sales role, whose name is stored. The saved one stays, even if they no longer are. */
async function closedByOf(id: string, saved: ClosedBy | null): Promise<ClosedBy> {
  if (saved?.refId === id) return saved;
  const member = await teamRepo.find(id);
  if (!member || member.status !== "Active" || !hasRole(member, SALES_ROLE)) throw new ValidationError({ closedById: "Pick who closed this booking from the Sales team." });
  return { refId: member.id, label: member.name };
}

/**
 * Writes `updated` only if the booking is still at `expectedUpdatedAt`.
 * When nothing was written, works out why: gone (404) or changed (412).
 */
async function writeIfUnchanged(updated: Booking, expectedUpdatedAt: string, payment: PaymentDoc | null, history: BookingHistoryDoc | null): Promise<Booking> {
  if (await updateBookingIfVersion(updated, expectedUpdatedAt, payment, history)) return updated;
  return notWritten("booking", () => findVersion(updated.bookingId));
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The bookings ledger: one page of bookings for the filters, the count and totals
 * of every match, the summary tiles and the destination list.
 */
export async function getBookingLedger(filters: BookingFilters): Promise<LedgerResult> {
  await verifySession();
  return ledgerPage(filters, todayIST());
}

/**
 * One booking by its UUID. Throws NotFoundError.
 * Cached per render, so components of one page that ask for the same booking
 * share a single read.
 */
export const getBooking = cache(async (id: string): Promise<Booking> => {
  await verifySession();
  assertBookingId(id);

  const booking = await findBooking(id);
  if (!booking) throw new NotFoundError("booking");
  return booking;
});

/** Invoice numbers allow / (e.g. GC/2026/7): the download's name keeps to safe characters. */
function billFileName(invoiceNumber: string, day?: string): string {
  const safe = invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `Bill-of-Supply-${safe || "invoice"}${day ? `-${day}` : ""}.pdf`;
}

/**
 * The Bill of Supply PDF, drawn from the latest saved booking, with its file
 * name. Archived bookings have none until restored.
 */
export async function getBillOfSupply(id: string): Promise<BillFile> {
  await verifySession();
  assertBookingId(id);
  const booking = await findBillBooking(id); // only what the bill prints
  if (!booking) throw new NotFoundError("booking");
  if (isArchived(booking)) throw new BillUnavailableError();
  return billFile({ ...booking, cancellation: cancellationOf(booking) }, billFileName(booking.invoiceNumber));
}

/** A booking's history, newest first. */
export async function getBookingHistory(id: string): Promise<HistoryRow[]> {
  await verifySession();
  assertBookingId(id);
  return bookingHistory(await findHistory(id));
}

/** One page of a booking's history, newest first. Each row is worked out from the one before, so the whole history is read. */
export async function getBookingHistoryPage(id: string, page: number): Promise<{ items: HistoryRow[] } & PageInfo> {
  const rows = await getBookingHistory(id);
  const rowsOn = (p: number) => rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  return clampPage(page, PAGE_SIZE, rowsOn(page), rows.length, async (p) => rowsOn(p));
}

/** The bill as it stood at one point in the booking's history. Archived bookings have no bill. */
export async function getHistoryBill(id: string, entryId: string): Promise<BillFile> {
  await verifySession();
  assertBookingId(id);
  assertRecordId("history entry", bookingIdSchema, entryId);
  const [booking, entry] = await Promise.all([findBillBooking(id), findHistoryBill(id, entryId)]);
  if (!booking) throw new NotFoundError("booking");
  if (isArchived(booking)) throw new BillUnavailableError();
  if (!entry) throw new NotFoundError("history entry");
  // A cancelled row saved before its bill kept the cancellation: its dates come from the booking, or the row's own day
  const cancellation =
    entry.bill.cancellation ??
    (isCancelledEvent(entry.event)
      ? { cancelledOn: booking.cancelledOn ?? entry.changedOn, refundAmount: entry.refundAmount ?? 0, refundedOn: entry.refundPaid ? (booking.refundedOn ?? entry.changedOn) : null }
      : null);
  return billFile({ ...entry.bill, cancellation }, billFileName(entry.bill.invoiceNumber, toISODate(entry.changedOn)));
}

type BillFile = { bytes: Uint8Array; type: "application/pdf"; fileName: string; invoiceNumber: string };

async function billFile(bill: BillBooking, fileName: string): Promise<BillFile> {
  try {
    const bytes = await renderBillOfSupply(bill);
    return { bytes, type: "application/pdf", fileName, invoiceNumber: bill.invoiceNumber };
  } catch (err) {
    // A booking edited outside the app can hold values the bill can't fit
    if (err instanceof BillDoesNotFitError) throw new ValidationError(err.problems as Record<string, string>);
    throw err;
  }
}

/**
 * The invoice number a booking saved now would most likely get, for each date
 * it can have (invoiceDateChoices: they differ only in the first days of January). Shown on the
 * new-booking form; the number is assigned on save.
 */
export async function suggestInvoiceNumbers(): Promise<Record<string, string>> {
  await verifySession();
  const dates = invoiceDateChoices(todayIST());
  const numbers = await Promise.all(
    dates.map(async (date) => {
      const year = yearOf(date);
      return formatInvoiceNumber(year, nextSequence(await peekSequence("invoice", year), getEnv().INITIAL_INVOICE_NUMBER));
    })
  );
  return Object.fromEntries(dates.map((date, i) => [date, numbers[i]]));
}

/** The booking form's dropdowns: each list's active names (destination, package, route), by name. */
export async function getBookingListOptions(): Promise<BookingListOptions> {
  await verifySession();
  const lists = await Promise.all(LIST_FIELD_IDS.map((field) => getGeneralOptions(LIST_FIELDS[field])));
  return Object.fromEntries(LIST_FIELD_IDS.map((field, i) => [field, lists[i].map((option) => option.name)])) as BookingListOptions;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const oneCreatePerKey = onePerKey<Booking>();

/**
 * Creates a booking with the next invoice number (of its invoice date's year)
 * and the default due date. Repeats with the same idempotency key (double submit,
 * retry) return the first booking instead of creating another: a repeat that
 * arrives while the first is still saving waits for it (so it never takes an
 * invoice number of its own), and the database's unique key on idempotencyKey
 * covers repeats that reach another server instance.
 */
export async function createBooking(input: unknown, idempotencyKey?: string): Promise<Booking> {
  await verifySession();
  return oneCreatePerKey(idempotencyKey, () => createNewBooking(input, idempotencyKey));
}

async function createNewBooking(input: unknown, idempotencyKey?: string): Promise<Booking> {
  const today = todayIST();
  // Email, slot amount and invoice date may be left out: a create without them means "no email", ₹0, today
  const draft = validate(bookingDraftSchema, input && typeof input === "object" ? { customerEmail: "", slotAmount: 0, invoiceDate: today, ...input } : input);
  const { invoiceDate, closedById } = draft;
  const dateIssue = invoiceDateIssue(invoiceDate, today);
  if (dateIssue) throw new ValidationError({ invoiceDate: dateIssue });
  assertTripDatesAllowed(draft, invoiceDate);

  const [earlier, fitsBill] = await Promise.all([
    idempotencyKey ? findByIdempotencyKey(idempotencyKey) : null,
    loadBillFitCheck(),
  ]);
  if (earlier) return earlier;
  Object.assign(draft, await fromLists(draft));
  const closedBy = await closedByOf(closedById, null);

  // Everything is checked before a number is taken, so a refused booking never uses one up
  const year = yearOf(invoiceDate);
  const dueDate = defaultDueDate(draft.tripStartDate, invoiceDate);
  const longestNumber = formatInvoiceNumber(year, 99_999);
  const checked = validate(createBookingSchema, { ...draft, invoiceNumber: longestNumber, invoiceDate, dueDate });
  assertFitsBill(fitsBill, { ...checked, ...calculateBookingAmounts(checked) });

  const sequence = await issueSequence("invoice", year, getEnv().INITIAL_INVOICE_NUMBER);
  const data: BookingInput = { ...checked, invoiceNumber: formatInvoiceNumber(year, sequence) };

  const now = new Date().toISOString();
  const booking: Booking = {
    ...data,
    ...calculateBookingAmounts(data),
    bookingId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    bookingStatus: "Active",
    cancelledOn: null,
    refundAmount: 0,
    refundedOn: null,
    refundedAt: null,
    closedBy,
  };
  // What was paid at booking time is the first entry of cash collected
  return insertBooking(booking, paymentEntry(booking.bookingId, booking.amountPaid, invoiceDate, "create"), historyEntry(booking.bookingId, invoiceDate, booking), idempotencyKey);
}

/**
 * Updates a booking. The change is merged onto the stored record and the
 * whole result is re-validated, so cross-field rules always hold.
 * `expectedUpdatedAt` is the version the user edited (sent as X-Record-Version).
 */
export async function updateBooking(id: string, input: unknown, expectedUpdatedAt: string): Promise<Booking> {
  await verifySession();
  assertBookingId(id);
  const changes = validate(updateBookingSchema, input);

  const [booking, fitsBill] = await Promise.all([findBooking(id), loadBillFitCheck()]);
  if (!booking) throw new NotFoundError("booking"); // before the version: an unknown booking is 404, not 428
  assertCurrentVersion("booking", booking.updatedAt, expectedUpdatedAt);
  if (isArchived(booking)) throw new ArchivedRecordError("booking");
  if (booking.bookingStatus === "Cancelled" && CANCELLED_LOCKED.some((field) => changes[field] !== undefined && changes[field] !== booking[field])) {
    throw new BookingRuleError("A cancelled booking's money can't be changed. Reactivate it first.");
  }
  const newType = changes.packageType !== undefined && changes.packageType !== booking.packageType ? changes.packageType : undefined;
  // Cancelled: its type is locked too, but one saved before types can be given one that leaves its money as it is
  if (booking.bookingStatus === "Cancelled" && newType && (booking.packageType !== null || (newType === "Private" && booking.slotAmount > 0))) {
    throw new BookingRuleError("A cancelled booking's package type can't be changed. Reactivate it first.");
  }

  // A changed destination, package or route must come from its list; an
  // unchanged one (same name, any case) stays as saved, even if archived since
  const listChanges: Partial<Record<ListField, string>> = {};
  for (const field of LIST_FIELD_IDS) {
    const value = changes[field];
    if (value === undefined) continue;
    if (nameKeyOf(value) === nameKeyOf(booking[field])) delete changes[field];
    else listChanges[field] = value;
  }
  Object.assign(changes, await fromLists({ ...listChanges, routeOther: changes.routeOther }));

  // A booking saved before Closed by existed must get one on its next edit
  const closedBy = changes.closedById === undefined ? booking.closedBy : await closedByOf(changes.closedById, booking.closedBy);
  if (!closedBy) throw new ValidationError({ closedById: "Choose who closed this booking." });

  // The invoice number and date never change. A changed trip start or end
  // must come after the invoice date; a new start moves the due date.
  const merged = { ...booking, ...changes } as BookingInput;
  // Becoming private clears the slot amount; one sent along with it is refused
  if (newType === "Private" && changes.slotAmount === undefined) merged.slotAmount = 0;
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
    closedBy,
    updatedAt: nextTimestamp(booking.updatedAt),
  };
  assertFitsBill(fitsBill, updated, booking);
  // A changed amount paid is money received (or given back) today
  const payment = paymentEntry(id, updated.amountPaid - booking.amountPaid, todayIST(), "edit");
  // A change of people, price, slot amount or amount paid is a new row of its history; other edits aren't
  const history = historyChanged(booking, updated) ? historyEntry(id, todayIST(), updated) : null;
  return writeIfUnchanged(updated, expectedUpdatedAt, payment, history);
}

/**
 * Sets the booking status. Archiving is a soft delete, and restoring returns a
 * booking to what it was (a cancelled one stays cancelled, with its refund).
 * Cancelling stores the refund (`refundAmount`, or the terms' amount if none is
 * given); reactivating clears it, and is refused once the refund has gone back.
 */
export async function setBookingStatus(id: string, status: BookingStatus, expectedUpdatedAt: string, refundAmount?: number): Promise<BookingRef> {
  await verifySession();
  assertBookingId(id);
  await assertVersionFor("booking", expectedUpdatedAt, () => findVersion(id));

  const booking = await findBooking(id);
  if (!booking) throw new NotFoundError("booking");
  assertCurrentVersion("booking", booking.updatedAt, expectedUpdatedAt);
  const today = todayIST();
  if (isArchived(booking)) {
    if (status === "Archived") return booking;
    if (status === "Cancelled") throw new ArchivedRecordError("booking");
    // Only an active booking can be archived now; one archived while cancelled, before that rule, goes back to Cancelled with its refund
    return writeBookingEvent({ ...booking, bookingStatus: booking.cancelledOn ? "Cancelled" : "Active" }, expectedUpdatedAt, today, "restored");
  }
  if (status === "Archived") {
    if (booking.bookingStatus === "Cancelled") throw new BookingRuleError("A cancelled booking can't be archived. Reactivate it first.");
    return writeBookingEvent({ ...booking, bookingStatus: status }, expectedUpdatedAt, today, "archived");
  }
  if (booking.bookingStatus === status) {
    // A repeat is fine, but another refund on it must not answer as if it had saved
    if (refundAmount !== undefined && refundAmount !== booking.refundAmount) throw new BookingRuleError("This booking is already cancelled. Change its refund amount instead.");
    return booking;
  }

  if (status === "Cancelled") {
    const refund = refundAmount ?? refundQuote(booking, today).amount;
    assertRefundFits(refund, booking);
    return writeBookingEvent({ ...booking, bookingStatus: status, cancelledOn: today, refundAmount: refund, refundedOn: null, refundedAt: null }, expectedUpdatedAt, today, "cancelled");
  }
  if (booking.refundedOn) throw new BookingRuleError("The refund is marked paid. Untick it first, then reactivate the booking.");
  return writeBookingEvent({ ...booking, bookingStatus: status, cancelledOn: null, refundAmount: 0, refundedOn: null, refundedAt: null }, expectedUpdatedAt, today, "reactivated");
}

function assertRefundFits(refund: number, booking: Pick<Booking, "amountPaid">): void {
  if (refund > booking.amountPaid) throw new ValidationError({ refundAmount: `Refund cannot be more than the ₹${formatAmount(booking.amountPaid)} received.` });
}

/** Saves a status or refund change with its history row, together, at the version on screen. */
function writeBookingEvent(changed: Booking, expectedUpdatedAt: string, changedOn: string, event: HistoryEvent): Promise<Booking> {
  const updated = { ...changed, updatedAt: nextTimestamp(expectedUpdatedAt) };
  return writeIfUnchanged(updated, expectedUpdatedAt, null, historyEntry(updated.bookingId, changedOn, updated, event));
}

/** A cancelled booking's refund: change its amount (until it's paid), mark it paid (dated now), or undo that. */
async function changeRefund(id: string, change: z.infer<typeof refundChangeSchema>, expectedUpdatedAt: string): Promise<BookingRef> {
  await verifySession();
  assertBookingId(id);
  await assertVersionFor("booking", expectedUpdatedAt, () => findVersion(id));
  const booking = await findBooking(id);
  if (!booking) throw new NotFoundError("booking");
  assertCurrentVersion("booking", booking.updatedAt, expectedUpdatedAt);
  if (booking.bookingStatus !== "Cancelled") throw new BookingRuleError("Only a cancelled booking has a refund.");

  const today = todayIST();
  if ("refundAmount" in change) {
    if (booking.refundedOn) throw new BookingRuleError("The refund is marked paid. Untick it to change the amount.");
    if (change.refundAmount === booking.refundAmount) return booking;
    assertRefundFits(change.refundAmount, booking);
    return writeBookingEvent({ ...booking, refundAmount: change.refundAmount }, expectedUpdatedAt, today, "refund-changed");
  }

  if (change.refundPaid === Boolean(booking.refundedOn)) return booking;
  if (!change.refundPaid) return writeBookingEvent({ ...booking, refundedOn: null, refundedAt: null }, expectedUpdatedAt, today, "refund-undone");
  if (booking.refundAmount <= 0) throw new BookingRuleError("There is no refund to mark as paid.");
  return writeBookingEvent({ ...booking, refundedOn: today, refundedAt: new Date().toISOString() }, expectedUpdatedAt, today, "refund-paid");
}

/** Soft-deletes an active booking (a cancelled one is reactivated first). It stays in the database and can be restored. */
export function archiveBooking(id: string, expectedUpdatedAt: string): Promise<BookingRef> {
  return setBookingStatus(id, "Archived", expectedUpdatedAt);
}

/** A PATCH: { bookingStatus } cancels, reactivates or restores; { refundAmount } or { refundPaid } is the refund; anything else is an edit. */
export function changeBooking(id: string, input: unknown, expectedUpdatedAt: string): Promise<BookingRef> {
  return statusOrEdit(input, statusChangeSchema, {
    status: (change) => setBookingStatus(id, change.bookingStatus, expectedUpdatedAt, "refundAmount" in change ? change.refundAmount : undefined),
    edit: (other) =>
      statusOrEdit(other, refundChangeSchema, {
        status: (refund) => changeRefund(id, refund, expectedUpdatedAt),
        edit: (changes) => updateBooking(id, changes, expectedUpdatedAt),
      }),
  });
}
