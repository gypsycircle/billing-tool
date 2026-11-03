// lib/domain/filters.ts
// List filters and the page number, parsed from the URL (never trusted). The
// database applies them (lib/server/db/ledger-query.ts, expense-query.ts).
// The URL-parameter rules here are shared by every list.

import { z } from "zod";
import { dateRangeParams, orderedRange } from "./date-range";
import { fromISODate, toISODate } from "./dates";
import { REFUND_STATUSES } from "./refunds";
import type { DueBucket } from "./summary";
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "./types";

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

const filtersSchema = z.object({
  q: param.transform((v) => v.trim().slice(0, 100)),
  destination: param.transform((v) => v.trim().slice(0, 100)),
  payment: oneOf([...PAYMENT_STATUSES, ...REFUND_STATUSES]),
  /** The trip status: archived bookings have their own view (`archived`). */
  status: oneOf(BOOKING_STATUSES.filter((s) => s !== "Archived")),
  archived: flag,
  due: oneOf(DUE_FILTERS),
  /** Trip start from / to (DD/MM/YYYY; "" for an open end). */
  from: isoDayParam,
  to: isoDayParam,
  /** The one day it was booked: the invoice date (DD/MM/YYYY; "" for any). */
  booked: isoDayParam,
  /** The team member who closed it (their ID; "" for anyone). */
  closedBy: param.transform((v) => (z.uuid().safeParse(v).success ? v : "")),
  page: pageParam,
}).transform(({ status, due, ...filters }) => ({
  ...filters,
  ...orderedRange(filters),
  // The archived view holds archived bookings only: no trip status to pick, none of them due
  status: filters.archived ? undefined : status,
  due: filters.archived ? undefined : due,
}));

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
    destination: filters.destination,
    payment: filters.payment ?? "",
    status: filters.status ?? "",
    archived: filters.archived ? "1" : "",
    due: filters.due ?? "",
    ...dateRangeParams(filters),
    booked: filters.booked ? toISODate(filters.booked) : "",
    closedBy: filters.closedBy,
  };
}

/** True when any filter narrows the list (used for "no results" vs "empty"). */
export function hasActiveFilters(filters: BookingFilters): boolean {
  return Boolean(filters.q || filters.destination || filters.payment || filters.status || filters.archived || filters.due || filters.from || filters.to || filters.booked || filters.closedBy);
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
