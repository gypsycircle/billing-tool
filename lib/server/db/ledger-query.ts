// lib/server/db/ledger-query.ts
// The bookings ledger's filters → MongoDB queries. Pure (no I/O). Each query has an index
// in collections.ts to serve it; db.test.ts checks the answers and the plans.

import "server-only";

import type { Document, Filter } from "mongodb";
import { addDays } from "@/lib/domain/dates";
import type { BookingFilters } from "@/lib/domain/filters";
import type { BookingStatus } from "@/lib/domain/types";
import { DUE_SOON_DAYS } from "@/lib/domain/summary";
import type { BookingDoc } from "./collections";
import { destinationKeyOf, digitsOf, toDate, withinDays } from "./mapping";
import { escapeRegex, searchAny } from "./search";

const SEARCH_FIELDS = ["customerName", "invoiceNumber", "packageName", "destination", "batchName", "customerEmail"] as const;

/** today and today + DUE_SOON_DAYS, as dates. */
function dueWindow(today: string): { today: Date; soonEnd: Date } {
  return { today: toDate(today), soonEnd: toDate(addDays(today, DUE_SOON_DAYS)) };
}

/** Active, with a balance: the bookings that can be due or overdue. */
const OWING = { bookingStatus: "Active", balanceAmount: { $gt: 0 } } as const;

/** Cancelled, with money to give back. */
const REFUNDING = { bookingStatus: "Cancelled", refundAmount: { $gt: 0 } } as const;

/** Every booking but the archived ones. A list of values (not $ne), so the ledger index serves the sort. */
const NOT_ARCHIVED: { $in: BookingStatus[] } = { $in: ["Active", "Cancelled"] };

/**
 * The index the page of rows must use, when the planner might pick wrong: with
 * a trip-date range or a booked date it could take that date's index and sort
 * in memory, so a newest-first one is named (with a person or a destination,
 * their own).
 */
export const ledgerHint = (filters: BookingFilters): string | undefined => {
  if (!filters.from && !filters.to && !filters.booked) return undefined;
  if (filters.closedBy) return "status_closedBy_createdAt_id";
  return filters.destination ? "status_destination_createdAt_id" : "status_createdAt_id";
};

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
  if (filters.payment === "Refund due") and.push({ ...REFUNDING, refundedOn: null });
  else if (filters.payment === "Refunded") and.push({ ...REFUNDING, refundedOn: { $ne: null } });
  else if (filters.payment) and.push({ paymentStatus: filters.payment });
  if (filters.destination) and.push({ destinationKey: destinationKeyOf(filters.destination) });
  const tripStart = withinDays(filters);
  if (tripStart) and.push({ tripStartDate: tripStart });
  if (filters.booked) and.push({ invoiceDate: toDate(filters.booked) });
  if (filters.closedBy) and.push({ "closedBy.refId": filters.closedBy });

  if (filters.q) {
    const or = searchAny(SEARCH_FIELDS, filters.q) as Filter<BookingDoc>[];
    const qDigits = digitsOf(filters.q);
    if (qDigits.length >= 3) or.push({ customerPhoneDigits: { $regex: escapeRegex(qDigits) } });
    and.push({ $or: or });
  }

  if (filters.due) {
    const { today: start, soonEnd } = dueWindow(today);
    and.push({ ...OWING, dueDate: filters.due === "overdue" ? { $lte: start } : { $gt: start, $lte: soonEnd } });
  }

  return and.length === 1 ? and[0] : { $and: and };
}

const isActive = { $eq: ["$bookingStatus", "Active"] };
const isCancelled = { $eq: ["$bookingStatus", "Cancelled"] };

/** Received on an active booking, or what a cancelled one keeps. Anything else is 0. */
const COLLECTED = {
  $cond: [isActive, "$amountPaid", { $cond: [isCancelled, { $subtract: ["$amountPaid", { $ifNull: ["$refundAmount", 0] }] }, 0] }],
};

/** Sums for the summary tiles, over active bookings and the cancelled ones' money (due and overdue as in the due filter). */
export function summaryGroup(today: string): Document[] {
  const { today: start, soonEnd } = dueWindow(today);
  const owing = { $and: [isActive, { $gt: ["$balanceAmount", 0] }] };
  const refundDue = { $and: [isCancelled, { $gt: ["$refundAmount", 0] }, { $eq: [{ $ifNull: ["$refundedOn", null] }, null] }] };
  const overdue = { $and: [owing, { $lte: ["$dueDate", start] }] };
  const dueSoon = { $and: [owing, { $gt: ["$dueDate", start] }, { $lte: ["$dueDate", soonEnd] }] };
  return [
    { $match: { bookingStatus: NOT_ARCHIVED } },
    {
      $group: {
        _id: null,
        activeCount: { $sum: { $cond: [isActive, 1, 0] } },
        activeTravellers: { $sum: { $cond: [isActive, "$travellers", 0] } },
        outstanding: { $sum: { $cond: [isActive, "$balanceAmount", 0] } },
        collected: { $sum: COLLECTED },
        refundsDueCount: { $sum: { $cond: [refundDue, 1, 0] } },
        refundsDueAmount: { $sum: { $cond: [refundDue, "$refundAmount", 0] } },
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
      activeReceived: { $sum: COLLECTED },
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
