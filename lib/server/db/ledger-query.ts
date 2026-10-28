// lib/server/db/ledger-query.ts
// Dashboard filters → MongoDB queries. Pure (no I/O). Each query has an index
// in collections.ts to serve it; db.test.ts checks the answers and the plans.

import "server-only";

import type { Document, Filter } from "mongodb";
import { addDays } from "@/lib/domain/dates";
import type { BookingFilters } from "@/lib/domain/filters";
import type { BookingStatus } from "@/lib/domain/types";
import { DUE_SOON_DAYS } from "@/lib/domain/summary";
import type { BookingDoc } from "./collections";
import { destinationKeyOf, digitsOf, toDate } from "./mapping";

/** A user's search text as a literal, case-insensitive pattern (never a regex they wrote). */
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SEARCH_FIELDS = ["customerName", "invoiceNumber", "packageName", "destination", "batchName", "customerEmail"] as const;

/** today and today + DUE_SOON_DAYS, as dates. */
function dueWindow(today: string): { today: Date; soonEnd: Date } {
  return { today: toDate(today), soonEnd: toDate(addDays(today, DUE_SOON_DAYS)) };
}

/** Active, with a balance: the bookings that can be due or overdue. */
const OWING = { bookingStatus: "Active", balanceAmount: { $gt: 0 } } as const;

/** Every booking but the archived ones. A list of values (not $ne), so the ledger index serves the sort. */
const NOT_ARCHIVED: { $in: BookingStatus[] } = { $in: ["Active", "Cancelled"] };

/**
 * The ledger's filter. Search matches any of SEARCH_FIELDS (case-insensitive,
 * literally) or 3+ phone digits; the due filter keeps active bookings with a
 * balance, overdue or due within DUE_SOON_DAYS.
 */
export function ledgerMatch(filters: BookingFilters, today: string): Filter<BookingDoc> {
  const and: Filter<BookingDoc>[] = [];

  // The archived view shows archived bookings only; otherwise they are hidden
  and.push({ bookingStatus: filters.archived ? "Archived" : NOT_ARCHIVED });
  if (filters.status) and.push({ bookingStatus: filters.status });
  if (filters.payment) and.push({ paymentStatus: filters.payment });
  if (filters.destination) and.push({ destinationKey: destinationKeyOf(filters.destination) });

  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    const or: Filter<BookingDoc>[] = SEARCH_FIELDS.map((field) => ({ [field]: pattern }) as Filter<BookingDoc>);
    const qDigits = digitsOf(filters.q);
    if (qDigits.length >= 3) or.push({ customerPhoneDigits: { $regex: escapeRegex(qDigits) } });
    and.push({ $or: or });
  }

  if (filters.due) {
    const { today: start, soonEnd } = dueWindow(today);
    and.push({ ...OWING, dueDate: filters.due === "overdue" ? { $lt: start } : { $gte: start, $lte: soonEnd } });
  }

  return and.length === 1 ? and[0] : { $and: and };
}

/** Sums for the summary tiles, over active bookings (due and overdue as in the due filter). */
export function summaryGroup(today: string): Document[] {
  const { today: start, soonEnd } = dueWindow(today);
  const owing = { $gt: ["$balanceAmount", 0] };
  const overdue = { $and: [owing, { $lt: ["$dueDate", start] }] };
  const dueSoon = { $and: [owing, { $gte: ["$dueDate", start] }, { $lte: ["$dueDate", soonEnd] }] };
  return [
    { $match: { bookingStatus: "Active" } },
    {
      $group: {
        _id: null,
        activeCount: { $sum: 1 },
        activeTravellers: { $sum: "$travellers" },
        outstanding: { $sum: "$balanceAmount" },
        collected: { $sum: "$amountPaid" },
        overdueCount: { $sum: { $cond: [overdue, 1, 0] } },
        dueSoonCount: { $sum: { $cond: [dueSoon, 1, 0] } },
        dueSoonAmount: { $sum: { $cond: [dueSoon, "$balanceAmount", 0] } },
      },
    },
  ];
}

/** Count and totals of every matching booking (all of them, and the active ones). */
export const matchingGroup: Document[] = [
  {
    $group: {
      _id: null,
      count: { $sum: 1 },
      total: { $sum: "$totalAmount" },
      received: { $sum: "$amountPaid" },
      balance: { $sum: "$balanceAmount" },
      activeCount: { $sum: { $cond: [{ $eq: ["$bookingStatus", "Active"] }, 1, 0] } },
      activeTotal: { $sum: { $cond: [{ $eq: ["$bookingStatus", "Active"] }, "$totalAmount", 0] } },
      activeReceived: { $sum: { $cond: [{ $eq: ["$bookingStatus", "Active"] }, "$amountPaid", 0] } },
      activeBalance: { $sum: { $cond: [{ $eq: ["$bookingStatus", "Active"] }, "$balanceAmount", 0] } },
    },
  },
];

/**
 * Distinct destinations for the filter menu (all bookings), alphabetical.
 * Sorting on the destinationKey_destination index before grouping lets
 * MongoDB jump from one destination to the next in the index (DISTINCT_SCAN)
 * instead of reading every booking.
 */
export const destinationsGroup: Document[] = [
  { $match: { destinationKey: { $gt: "" } } },
  { $sort: { destinationKey: 1 } },
  { $group: { _id: "$destinationKey", destination: { $first: "$destination" } } },
  { $sort: { _id: 1 } },
];
