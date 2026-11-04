// lib/domain/refunds.ts
// What a cancelled booking gives back, from the bill's terms (lib/server/pdf/company.ts):
// a percentage of the package amount by days before the trip, limited to what was
// received less the non-refundable slot amount (a private package has none, so
// all of it). Staff can change the suggested amount.

import { formatAmount } from "./money";
import { parseDDMMYYYY } from "./dates";
import type { Booking, PaymentStatus } from "./types";

export const REFUND_STATUSES = ["Refund due", "Refunded", "No refund"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

const DAY_MS = 86_400_000;

/** Whole days from one DD/MM/YYYY date to another (negative once it has passed). */
const daysBetween = (from: string, to: string) => Math.round((parseDDMMYYYY(to)!.getTime() - parseDDMMYYYY(from)!.getTime()) / DAY_MS);

/** The terms' percentage for cancelling this many days before the trip. */
export function refundPercent(days: number): number {
  if (days >= 30) return 75;
  if (days >= 14) return 50;
  if (days >= 7) return 25;
  return 0;
}

export type RefundFigures = Pick<Booking, "totalAmount" | "amountPaid" | "slotAmount" | "tripStartDate" | "packageType">;

export interface RefundQuote {
  days: number;
  percent: number;
  /** The percentage of the package amount. */
  byTerms: number;
  /** The most that can go back: received − slot amount (₹0 on a private package). */
  limit: number;
  /** The smaller of the two, in whole rupees. */
  amount: number;
}

export function refundQuote({ totalAmount, amountPaid, slotAmount, tripStartDate }: RefundFigures, today: string): RefundQuote {
  const days = daysBetween(today, tripStartDate);
  const percent = refundPercent(days);
  const byTerms = Math.floor((totalAmount * percent) / 100);
  const limit = Math.max(amountPaid - slotAmount, 0);
  return { days, percent, byTerms, limit, amount: Math.min(byTerms, limit) };
}

/** The working, in words, shown when cancelling. */
export function refundWorking({ days, percent, byTerms, limit }: RefundQuote, { totalAmount, slotAmount }: RefundFigures): string {
  const when = days < 0 ? "The trip has started" : days === 0 ? "The trip starts today" : `The trip starts in ${days === 1 ? "1 day" : `${days} days`}`;
  if (percent === 0) return `${when}: no refund under the terms.`;
  const terms = `${when}: ${percent}% of ₹${formatAmount(totalAmount)} = ₹${formatAmount(byTerms)}.`;
  // Said only when it's what decides the amount
  if (limit >= byTerms) return terms;
  return `${terms} At most ₹${formatAmount(limit)} can go back${slotAmount > 0 ? ` (₹${formatAmount(slotAmount)} slot kept)` : ""}.`;
}

type RefundState = Pick<Booking, "bookingStatus" | "refundAmount" | "refundedOn">;

/** Where a cancelled booking's refund stands (null for any other booking). */
export function refundStatusOf({ bookingStatus, refundAmount, refundedOn }: RefundState): RefundStatus | null {
  if (bookingStatus !== "Cancelled") return null;
  if (!(refundAmount > 0)) return "No refund";
  return refundedOn ? "Refunded" : "Refund due";
}

/** The money badge: a cancelled booking's refund status, or the stored payment status (Refunded on a booking archived after its refund went back). The stored status never changes for this. */
export const paymentBadgeOf = (booking: RefundState & Pick<Booking, "paymentStatus">): PaymentStatus | RefundStatus =>
  refundStatusOf(booking) ?? (booking.refundedOn ? "Refunded" : booking.paymentStatus);

/** What a cancelled booking's bill prints about it. */
export interface BillCancellation {
  /** DD/MM/YYYY; null on bookings cancelled before the date was kept. */
  cancelledOn: string | null;
  refundAmount: number;
  refundedOn: string | null;
}

type CancellationState = Pick<Booking, "bookingStatus"> & Partial<Pick<Booking, "cancelledOn" | "refundAmount" | "refundedOn">>;

/** The cancellation a booking's bill shows, or null when it isn't cancelled (an archived one goes by its cancelled date). */
export function cancellationOf({ bookingStatus, cancelledOn, refundAmount, refundedOn }: CancellationState): BillCancellation | null {
  if (bookingStatus !== "Cancelled" && !cancelledOn) return null;
  return { cancelledOn: cancelledOn ?? null, refundAmount: refundAmount ?? 0, refundedOn: refundedOn ?? null };
}

/** The money a cancelled booking keeps: received − refund, paid yet or not. */
export const keptAmount = ({ amountPaid, refundAmount }: Pick<Booking, "amountPaid" | "refundAmount">) => amountPaid - refundAmount;
