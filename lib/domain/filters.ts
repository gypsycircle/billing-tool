// lib/domain/filters.ts
// List filters and the page number, parsed from the URL (never trusted). The
// database applies them (lib/server/db/ledger-query.ts, expense-query.ts).
// The URL-parameter rules here are shared by every list.

import { z } from "zod";
import { orderedRange } from "./date-range";
import { fromISODate, toISODate } from "./dates";
import { REFUND_STATUSES, type RefundStatus } from "./refunds";
import type { DueBucket } from "./summary";
import { PAYMENT_STATUSES, type BookingStatus, type PaymentStatus } from "./types";

const DUE_FILTERS = ["overdue", "week"] as const satisfies readonly DueBucket[];

/** Rows per list page (bookings, expenses). */
export const PAGE_SIZE = 15;

/** One URL parameter as text ("" when absent; the first when repeated). */
export const param = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (Array.isArray(v) ? v[0] : v) ?? "");

/** A value from a fixed list, or undefined. */
export const oneOf = <T extends string>(values: readonly T[]) =>
  param.transform((v) => ((values as readonly string[]).includes(v) ? (v as T) : undefined));

/** "1" means on. */
export const flag = param.transform((v) => v === "1");

/** A page number from 1 on (anything else is page 1). */
export const pageParam = param.transform((v) => (/^[1-9]\d{0,5}$/.test(v) ? Number(v) : 1));

/** A YYYY-MM-DD parameter (a date-range filter's end) as DD/MM/YYYY, or "" when absent or not a real date. */
export const isoDayParam = param.transform((v) => fromISODate(v));

/** The Trip status filter's two choices; the first is the default. */
export const TRIP_STATUSES = ["Active", "Cancelled"] as const satisfies readonly BookingStatus[];
export type TripStatus = (typeof TRIP_STATUSES)[number];

/** What the Payment filter offers: refunds in the cancelled list (nothing else tells cancelled bookings apart by money), payment statuses otherwise. */
export function paymentFilterOptions(status: TripStatus): readonly (PaymentStatus | RefundStatus)[] {
  return status === "Cancelled" ? REFUND_STATUSES : PAYMENT_STATUSES;
}

/** One of a booking's two date ranges, under its own names; a reversed one is dropped. */
function rangeOf<P extends "trip" | "booked">(prefix: P, from: string, to: string) {
  const range = orderedRange({ from, to });
  return { [`${prefix}From`]: range.from, [`${prefix}To`]: range.to } as Record<`${P}From` | `${P}To`, string>;
}

const iso = (day: string) => (day ? toISODate(day) : "");

const filtersSchema = z.object({
  q: param.transform((v) => v.trim().slice(0, 100)),
  /** A package's name, as in the Settings list. */
  package: param.transform((v) => v.trim().slice(0, 150)),
  payment: oneOf([...PAYMENT_STATUSES, ...REFUND_STATUSES]),
  /** The trip status, Active unless Cancelled is asked for; not in the archived view, as only active bookings get archived. */
  status: oneOf(TRIP_STATUSES),
  archived: flag,
  due: oneOf(DUE_FILTERS),
  /** The trip's start date, from / to (DD/MM/YYYY; "" for an open end). */
  tripFrom: isoDayParam,
  tripTo: isoDayParam,
  /** The day it was booked (its invoice date), from / to (DD/MM/YYYY; "" for an open end). */
  bookedFrom: isoDayParam,
  bookedTo: isoDayParam,
  /** The team member who closed it (their ID; "" for anyone). */
  closedBy: param.transform((v) => (z.uuid().safeParse(v).success ? v : "")),
  page: pageParam,
}).transform((filters) => {
  const status = filters.archived ? "Active" : (filters.status ?? "Active");
  return {
    ...filters,
    ...rangeOf("trip", filters.tripFrom, filters.tripTo),
    ...rangeOf("booked", filters.bookedFrom, filters.bookedTo),
    status,
    payment: filters.payment && paymentFilterOptions(status).includes(filters.payment) ? filters.payment : undefined,
    // Only an active booking has anything due
    due: status === "Cancelled" ? undefined : filters.due,
  };
});

export type BookingFilters = z.infer<typeof filtersSchema>;

/** Reads filters from Next.js searchParams; unknown or malformed values are dropped. */
export function parseBookingFilters(
  params: Record<string, string | string[] | undefined>
): BookingFilters {
  return filtersSchema.parse(params);
}

/** The filters that are set, as URL parameters (for page links). */
export function bookingFilterParams(filters: BookingFilters): Record<string, string> {
  return {
    q: filters.q,
    package: filters.package,
    payment: filters.payment ?? "",
    status: filters.status === "Cancelled" ? filters.status : "",
    archived: filters.archived ? "1" : "",
    due: filters.due ?? "",
    tripFrom: iso(filters.tripFrom),
    tripTo: iso(filters.tripTo),
    bookedFrom: iso(filters.bookedFrom),
    bookedTo: iso(filters.bookedTo),
    closedBy: filters.closedBy,
  };
}

/** True when any filter narrows the list (used for "no results" vs "empty"). */
export function hasActiveFilters(filters: BookingFilters): boolean {
  return Boolean(filters.q || filters.package || filters.payment || filters.status === "Cancelled" || filters.archived || filters.due || filters.tripFrom || filters.tripTo || filters.bookedFrom || filters.bookedTo || filters.closedBy);
}

/** The URL parameters of each date range a list has. */
const RANGE_PARAMS = [["from", "to"], ["tripFrom", "tripTo"], ["bookedFrom", "bookedTo"]] as const;

/** How many filters a list's URL parameters apply: a date range's two ends are one, and a search isn't a filter. */
export function appliedFilterCount(params: Readonly<Record<string, string>>): number {
  const notCounted: readonly string[] = ["q", ...RANGE_PARAMS.flat()];
  const others = Object.entries(params).filter(([key, value]) => value && !notCounted.includes(key));
  return others.length + RANGE_PARAMS.filter(([from, to]) => params[from] || params[to]).length;
}

/** The bookings' count on the Filters button: the trip status counts, Active included, as one is always chosen; the archived view has none. */
export function bookingFilterCount(filters: BookingFilters): number {
  const params = bookingFilterParams(filters);
  return appliedFilterCount(filters.archived ? params : { ...params, status: filters.status });
}

/** Where a page sits in the ledger. */
export interface PageInfo {
  /** 1-based, clamped to the last page. */
  page: number;
  pageCount: number;
  /** 1-based position of the first and last item shown (0 when empty). */
  from: number;
  to: number;
  total: number;
}
