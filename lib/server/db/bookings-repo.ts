// lib/server/db/bookings-repo.ts
// Persistence only: read and write bookings. No business rules (those live in
// lib/server/bookings/service.ts); invoice numbers come from counters-repo.ts.
// Each function is one database round trip unless noted, and every read
// fetches only the fields its caller uses.

import "server-only";

import { MongoNetworkError, MongoServerSelectionError, type Filter } from "mongodb";
import { PAGE_SIZE, type BookingFilters, type PageInfo } from "@/lib/domain/filters";
import type { LedgerSummary, LedgerTotals } from "@/lib/domain/summary";
import {
  LEDGER_ROW_FIELDS,
  type Booking,
  type LedgerRow,
} from "@/lib/domain/types";
import { DuplicateNumberError } from "../errors";
import { isDuplicateKey } from "./duplicate-key";
import { BILL_FIELDS, type BillBooking } from "../pdf/content";
import { bookingsCollection, settingsCollection, type BookingDoc, type BookingHistoryDoc, type PaymentDoc } from "./collections";
import { BOOKING_PROJECTION, bookingReads, bookingUpdateSet, fromBookingDoc, toBookingDoc } from "./mapping";
import { ledgerHint, ledgerMatch, matchingGroup, summaryGroup } from "./ledger-query";
import { clampPage, requestedPage, stripId } from "./paging";
import { insertHistory } from "./history-repo";
import { insertPayment } from "./payments-repo";
import { inTransaction } from "./transactions";

// ── Reads ─────────────────────────────────────────────────────────────────

export async function findBooking(id: string): Promise<Booking | null> {
  const doc = await (await bookingsCollection()).findOne({ _id: id }, { projection: BOOKING_PROJECTION });
  return doc ? fromBookingDoc(doc) : null;
}

const BILL_READ = [...BILL_FIELDS, "bookingStatus", "cancelledOn", "refundAmount", "refundedOn"] as const;
const BILL_PROJECTION = bookingReads.projectionOf(BILL_READ);

/** What the Bill of Supply prints, plus the status (archived bookings have no bill). */
export async function findBillBooking(id: string): Promise<(BillBooking & Pick<Booking, "bookingStatus" | "cancelledOn" | "refundAmount" | "refundedOn">) | null> {
  const doc = await (await bookingsCollection()).findOne({ _id: id }, { projection: BILL_PROJECTION });
  return doc ? bookingReads.pickFromDoc(doc, BILL_READ) : null;
}

/** The booking's current version (updatedAt), or null if there is no such booking. */
export async function findVersion(id: string): Promise<string | null> {
  const doc = await (await bookingsCollection()).findOne({ _id: id }, { projection: { _id: 0, updatedAt: 1 } });
  return doc ? doc.updatedAt.toISOString() : null;
}

export interface LedgerResult extends PageInfo {
  items: LedgerRow[];
  totals: LedgerTotals;
  summary: LedgerSummary;
  /** True when there are no bookings at all (empty ledger, not "no matches"). */
  empty: boolean;
}

const NO_TOTALS: LedgerTotals = {
  count: 0, total: 0, received: 0, balance: 0, activeCount: 0, activeTotal: 0, activeReceived: 0, activeBalance: 0, refunded: 0, refundTotal: 0,
};
const NO_SUMMARY: LedgerSummary = { activeCount: 0, activeTravellers: 0, outstanding: 0, collected: 0, refundsDueCount: 0, refundsDueAmount: 0, dueSoonCount: 0, dueSoonAmount: 0, overdueCount: 0 };

const LEDGER_ROW_PROJECTION = bookingReads.projectionOf(LEDGER_ROW_FIELDS);

/** Newest first; the _id tie-breaker keeps pages stable. Served by the status_createdAt_id index. */
const NEWEST_FIRST = { createdAt: -1, _id: 1 } as const;

type Grouped<T> = T & { _id: null };

/** The page of ledger rows, newest first (on the index ledgerHint names, when it names one). */
async function pageItems(filters: BookingFilters, match: Filter<BookingDoc>, skip: number, limit: number): Promise<LedgerRow[]> {
  const hint = ledgerHint(filters);
  const docs = await (await bookingsCollection())
    .find(match, { projection: LEDGER_ROW_PROJECTION, ...(hint ? { hint } : {}) })
    .sort(NEWEST_FIRST)
    .skip(skip)
    .limit(limit)
    .toArray();
  // Bookings saved before these fields existed have no slot amount, refund or Closed by
  return docs.map((doc) => ({ ...bookingReads.pickFromDoc(doc, LEDGER_ROW_FIELDS), slotAmount: doc.slotAmount ?? 0, packageType: doc.packageType ?? null, refundAmount: doc.refundAmount ?? 0, closedBy: doc.closedBy ?? null }));
}

/**
 * Everything the dashboard needs, as four small index-backed queries run in
 * PARALLEL (one round trip of waiting): the page of rows, the count and totals
 * of all matches, the summary tiles and whether any booking exists. A page
 * past the end costs one more query for the last page.
 */
export async function ledgerPage(filters: BookingFilters, today: string, pageSize = PAGE_SIZE): Promise<LedgerResult> {
  const collection = await bookingsCollection();
  const match = ledgerMatch(filters, today);
  const page = requestedPage(filters.page);
  const fetchPage = (p: number) => pageItems(filters, match, (p - 1) * pageSize, pageSize);

  const [firstItems, matching, summary, any] = await Promise.all([
    fetchPage(page),
    collection.aggregate<Grouped<LedgerTotals>>([{ $match: match }, ...matchingGroup]).toArray(),
    collection.aggregate<Grouped<LedgerSummary>>(summaryGroup(today)).toArray(),
    collection.findOne({}, { projection: { _id: 1 } }),
  ]);

  const totals = { ...NO_TOTALS, ...stripId(matching[0]) };
  return {
    ...(await clampPage(page, pageSize, firstItems, totals.count, fetchPage)),
    totals,
    summary: { ...NO_SUMMARY, ...stripId(summary[0]) },
    empty: any === null,
  };
}

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Inserts a new booking, its first payment entry (if anything was paid) and
 * the first row of its history, together or not at all. With an idempotency key, a repeat of the same
 * create (double submit, retry) returns the booking the first request stored.
 */
export async function insertBooking(booking: Booking, payment: PaymentDoc | null, history: BookingHistoryDoc, idempotencyKey?: string): Promise<Booking> {
  const collection = await bookingsCollection();
  try {
    await inTransaction(async (session) => {
      await collection.insertOne(toBookingDoc(booking, idempotencyKey), { session });
      if (payment) await insertPayment(payment, session);
      await insertHistory(history, session);
    });
    return booking;
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    if (idempotencyKey && err.keyPattern?.idempotencyKey) {
      const first = await findByIdempotencyKey(idempotencyKey);
      if (first) return first;
    }
    if (err.keyPattern?.invoiceNumber) throw new DuplicateNumberError("booking", "Invoice number", booking.invoiceNumber);
    throw err;
  }
}

/** The booking a previous create with this key stored, if any. */
export async function findByIdempotencyKey(idempotencyKey: string): Promise<Booking | null> {
  const doc = await (await bookingsCollection()).findOne({ idempotencyKey }, { projection: BOOKING_PROJECTION });
  return doc ? fromBookingDoc(doc) : null;
}

/**
 * Replaces a booking's editable fields only if it is still at the version
 * the caller read (`updatedAt`), and records the payment entry its amount-paid
 * change makes, together or not at all. False when the booking is missing or
 * someone saved first — the caller tells which. No lock needed, and nothing
 * is read back (the caller already holds what was written).
 */
export async function updateBookingIfVersion(booking: Booking, expectedUpdatedAt: string, payment: PaymentDoc | null, history: BookingHistoryDoc | null): Promise<boolean> {
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) return false;
  const collection = await bookingsCollection();
  return inTransaction(async (session) => {
    const result = await collection.updateOne(
      { _id: booking.bookingId, updatedAt: expected },
      { $set: bookingUpdateSet(booking) },
      { session }
    );
    if (result.matchedCount !== 1) return false;
    if (payment) await insertPayment(payment, session);
    if (history) await insertHistory(history, session);
    return true;
  });
}


// ── Health ────────────────────────────────────────────────────────────────

export interface DbHealth {
  connected: boolean;
  collectionsReady: boolean;
  totalBookings: number;
  accessCodeSet: boolean;
  error?: string;
}

/**
 * Makes sure collections and indexes exist, counts bookings (from collection
 * metadata) and checks an access code is set — two reads in parallel. Any
 * answer proves the connection, so there is no separate ping.
 */
export async function checkDatabase(): Promise<DbHealth> {
  try {
    const [totalBookings, access] = await Promise.all([
      (await bookingsCollection()).estimatedDocumentCount(),
      (await settingsCollection()).findOne({ _id: "access" }, { projection: { _id: 1 } }),
    ]);
    return { connected: true, collectionsReady: true, totalBookings, accessCodeSet: access !== null };
  } catch (err) {
    const unreachable = err instanceof MongoNetworkError || err instanceof MongoServerSelectionError;
    return {
      connected: !unreachable,
      collectionsReady: false,
      totalBookings: 0,
      accessCodeSet: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
