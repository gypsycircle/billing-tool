// lib/server/db/bookings-repo.ts
// Persistence only: read and write bookings and invoice counters. No business
// rules (those live in lib/server/bookings/service.ts). Each function is one
// database round trip unless noted, and every read fetches only the fields
// its caller uses.

import "server-only";

import { MongoNetworkError, MongoServerError, MongoServerSelectionError, type Filter } from "mongodb";
import { PAGE_SIZE, type BookingFilters, type PageInfo } from "@/lib/domain/filters";
import type { LedgerSummary, LedgerTotals } from "@/lib/domain/summary";
import {
  LEDGER_ROW_FIELDS,
  type Booking,
  type BookingRef,
  type LedgerRow,
} from "@/lib/domain/types";
import { DuplicateInvoiceNumberError } from "../errors";
import { BILL_FIELDS, type BillBooking } from "../pdf/content";
import { bookingsCollection, countersCollection, settingsCollection, type BookingDoc } from "./collections";
import { BOOKING_PROJECTION, bookingUpdateSet, fromBookingDoc, pickFromDoc, projectionOf, toBookingDoc } from "./mapping";
import { destinationsGroup, ledgerMatch, matchingGroup, summaryGroup } from "./ledger-query";

// ── Reads ─────────────────────────────────────────────────────────────────

export async function findBooking(id: string): Promise<Booking | null> {
  const doc = await (await bookingsCollection()).findOne({ _id: id }, { projection: BOOKING_PROJECTION });
  return doc ? fromBookingDoc(doc) : null;
}

const BILL_READ = [...BILL_FIELDS, "bookingStatus"] as const;
const BILL_PROJECTION = projectionOf(BILL_READ);

/** What the Bill of Supply prints, plus the status (archived bookings have no bill). */
export async function findBillBooking(id: string): Promise<(BillBooking & Pick<Booking, "bookingStatus">) | null> {
  const doc = await (await bookingsCollection()).findOne({ _id: id }, { projection: BILL_PROJECTION });
  return doc ? pickFromDoc(doc, BILL_READ) : null;
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
  destinations: string[];
  /** True when there are no bookings at all (empty ledger, not "no matches"). */
  empty: boolean;
}

const NO_TOTALS: LedgerTotals = {
  count: 0, total: 0, received: 0, balance: 0, activeCount: 0, activeTotal: 0, activeReceived: 0, activeBalance: 0,
};
const NO_SUMMARY: LedgerSummary = { activeCount: 0, outstanding: 0, collected: 0, dueSoonCount: 0, dueSoonAmount: 0, overdueCount: 0 };

const LEDGER_ROW_PROJECTION = projectionOf(LEDGER_ROW_FIELDS);

/** Newest first; the _id tie-breaker keeps pages stable. Served by the status_createdAt_id index. */
const NEWEST_FIRST = { createdAt: -1, _id: 1 } as const;

type Grouped<T> = T & { _id: null };

/** The page of ledger rows, newest first. */
async function pageItems(match: Filter<BookingDoc>, skip: number, limit: number): Promise<LedgerRow[]> {
  const docs = await (await bookingsCollection())
    .find(match, { projection: LEDGER_ROW_PROJECTION })
    .sort(NEWEST_FIRST)
    .skip(skip)
    .limit(limit)
    .toArray();
  return docs.map((doc) => pickFromDoc(doc, LEDGER_ROW_FIELDS));
}

/**
 * Everything the dashboard needs, as four small index-backed queries run in
 * PARALLEL (one round trip of waiting): the page of rows, the count and totals
 * of all matches, the summary tiles and the destination list. Every booking
 * has a destination (it is required), so an empty destination list means an
 * empty ledger. A page past the end costs one more query for the last page.
 */
export async function ledgerPage(filters: BookingFilters, today: string, pageSize = PAGE_SIZE): Promise<LedgerResult> {
  const collection = await bookingsCollection();
  const match = ledgerMatch(filters, today);
  let page = Math.max(1, Math.floor(filters.page) || 1);

  const [firstItems, matching, summary, destinations] = await Promise.all([
    pageItems(match, (page - 1) * pageSize, pageSize),
    collection.aggregate<Grouped<LedgerTotals>>([{ $match: match }, ...matchingGroup]).toArray(),
    collection.aggregate<Grouped<LedgerSummary>>(summaryGroup(today)).toArray(),
    collection.aggregate<{ _id: string; destination: string }>(destinationsGroup).toArray(),
  ]);

  const totals = { ...NO_TOTALS, ...stripId(matching[0]) };
  const pageCount = Math.max(1, Math.ceil(totals.count / pageSize));
  let items = firstItems;
  if (page > pageCount) {
    page = pageCount;
    items = totals.count === 0 ? [] : await pageItems(match, (page - 1) * pageSize, pageSize);
  }

  const from = totals.count === 0 ? 0 : (page - 1) * pageSize + 1;
  return {
    items,
    page,
    pageCount,
    from,
    to: from === 0 ? 0 : from + items.length - 1,
    total: totals.count,
    totals,
    summary: { ...NO_SUMMARY, ...stripId(summary[0]) },
    destinations: destinations.map((d) => d.destination.trim()),
    empty: destinations.length === 0,
  };
}

function stripId<T extends { _id: unknown }>(value: T | undefined): Omit<T, "_id"> | undefined {
  if (!value) return undefined;
  const { _id, ...rest } = value;
  void _id;
  return rest;
}

// ── Invoice counter ───────────────────────────────────────────────────────

const counterId = (year: number) => `invoice:${year}`;

/** The year's last issued sequence, or null if none yet. Read-only (for the form's preview). */
export async function peekInvoiceSequence(year: number): Promise<number | null> {
  const doc = await (await countersCollection()).findOne({ _id: counterId(year) }, { projection: { _id: 0, seq: 1 } });
  return doc ? doc.seq : null;
}

/**
 * Atomically issues the year's next sequence: `firstNumber` for the year's
 * first booking, then +1 each time. Concurrent calls always get distinct numbers.
 */
export async function issueInvoiceSequence(year: number, firstNumber: number): Promise<number> {
  const doc = await (await countersCollection()).findOneAndUpdate(
    { _id: counterId(year) },
    [{ $set: { seq: { $add: [{ $ifNull: ["$seq", firstNumber - 1] }, 1] } } }],
    { upsert: true, returnDocument: "after", projection: { _id: 0, seq: 1 } }
  );
  if (!doc) throw new Error("Invoice counter update returned nothing");
  return doc.seq;
}

// ── Writes ────────────────────────────────────────────────────────────────

const isDuplicateKey = (err: unknown): err is MongoServerError => err instanceof MongoServerError && err.code === 11000;

/**
 * Inserts a new booking. With an idempotency key, a repeat of the same create
 * (double submit, retry) returns the booking the first request stored.
 */
export async function insertBooking(booking: Booking, idempotencyKey?: string): Promise<Booking> {
  const collection = await bookingsCollection();
  try {
    await collection.insertOne(toBookingDoc(booking, idempotencyKey));
    return booking;
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    if (idempotencyKey && err.keyPattern?.idempotencyKey) {
      const first = await findByIdempotencyKey(idempotencyKey);
      if (first) return first;
    }
    if (err.keyPattern?.invoiceNumber) throw new DuplicateInvoiceNumberError(booking.invoiceNumber);
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
 * the caller read (`updatedAt`). False when the booking is missing or someone
 * saved first — the caller tells which. Atomic: no lock needed, and nothing is
 * read back (the caller already holds what was written).
 */
export async function updateBookingIfVersion(booking: Booking, expectedUpdatedAt: string): Promise<boolean> {
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) return false;
  const result = await (await bookingsCollection()).updateOne(
    { _id: booking.bookingId, updatedAt: expected },
    { $set: bookingUpdateSet(booking) }
  );
  return result.matchedCount === 1;
}

const REF_FIELDS = ["bookingId", "invoiceNumber", "updatedAt", "bookingStatus"] as const;
const REF_PROJECTION = projectionOf(REF_FIELDS);

/**
 * Sets only the booking status, in one atomic call, if the booking is still at
 * `expectedUpdatedAt` and matches `extraFilter` (e.g. "not archived").
 * Returns the booking's new reference, or null when nothing matched — the
 * caller tells why.
 */
export async function setStatusIfVersion(
  id: string,
  expectedUpdatedAt: string,
  status: Booking["bookingStatus"],
  updatedAt: string,
  extraFilter: Filter<BookingDoc> = {}
): Promise<BookingRef | null> {
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) return null;
  const doc = await (await bookingsCollection()).findOneAndUpdate(
    { _id: id, updatedAt: expected, ...extraFilter },
    { $set: { bookingStatus: status, updatedAt: new Date(updatedAt) } },
    { returnDocument: "after", projection: REF_PROJECTION }
  );
  return doc ? pickFromDoc(doc, REF_FIELDS) : null;
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
