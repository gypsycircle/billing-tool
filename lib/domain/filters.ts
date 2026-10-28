// lib/domain/filters.ts
// Dashboard filters and the page number, parsed from the URL (never trusted).
// The database applies them (lib/server/db/ledger-query.ts).

import { z } from "zod";
import type { DueBucket } from "./summary";
import { BOOKING_STATUSES, PAYMENT_STATUSES, type Booking } from "./types";

const DUE_FILTERS = ["overdue", "week"] as const satisfies readonly DueBucket[];

/** Bookings per ledger page. */
export const PAGE_SIZE = 15;

const param = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (Array.isArray(v) ? v[0] : v) ?? "");

const filtersSchema = z.object({
  q: param.transform((v) => v.trim().slice(0, 100)),
  destination: param.transform((v) => v.trim().slice(0, 100)),
  payment: param.transform((v) =>
    (PAYMENT_STATUSES as readonly string[]).includes(v) ? (v as Booking["paymentStatus"]) : undefined
  ),
  status: param.transform((v) =>
    (BOOKING_STATUSES as readonly string[]).includes(v) ? (v as Booking["bookingStatus"]) : undefined
  ),
  archived: param.transform((v) => v === "1"),
  due: param.transform((v) => ((DUE_FILTERS as readonly string[]).includes(v) ? (v as DueBucket) : undefined)),
  page: param.transform((v) => (/^[1-9]\d{0,5}$/.test(v) ? Number(v) : 1)),
});

export type BookingFilters = z.infer<typeof filtersSchema>;

/** Reads filters from Next.js searchParams; unknown or malformed values are dropped. */
export function parseBookingFilters(
  params: Record<string, string | string[] | undefined>
): BookingFilters {
  return filtersSchema.parse(params);
}

/** True when any filter narrows the list (used for "no results" vs "empty"). */
export function hasActiveFilters(filters: BookingFilters): boolean {
  return Boolean(filters.q || filters.destination || filters.payment || filters.status || filters.archived || filters.due);
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
