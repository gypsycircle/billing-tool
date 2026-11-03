// lib/domain/refunds.ts
// What a cancelled booking gives back, from the bill's terms (lib/server/pdf/company.ts):
// a percentage of the package amount by days before the trip, limited to what was
// received less the non-refundable slot amount. Staff can change the suggested amount.

import { formatAmount } from "./money";
import { parseDDMMYYYY } from "./dates";
import type { Booking } from "./types";

export const REFUND_STATUSES = ["Refund due", "Refunded"] as const;
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

export type RefundFigures = Pick<Booking, "totalAmount" | "amountPaid" | "slotAmount" | "tripStartDate">;

export interface RefundQuote {
  days: number;
  percent: number;
  /** The percentage of the package amount. */
  byTerms: number;
  /** The most that can go back: received − slot amount. */
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
export function refundWorking({ days, percent, byTerms, limit }: RefundQuote, { totalAmount, amountPaid, slotAmount }: RefundFigures): string {
  const when = days < 0 ? "The trip has already started" : days === 0 ? "The trip starts today" : `The trip starts in ${days === 1 ? "1 day" : `${days} days`}`;
  const terms = percent === 0 ? "no refund under the terms" : `${percent}% of ₹${formatAmount(totalAmount)} = ₹${formatAmount(byTerms)}`;
  return `${when}: ${terms}. The most that can go back: ₹${formatAmount(amountPaid)} received − ₹${formatAmount(slotAmount)} slot = ₹${formatAmount(limit)}.`;
}

type RefundState = Pick<Booking, "bookingStatus" | "refundAmount" | "refundedOn">;

/** A cancelled booking's refund, if it has one. */
export function refundStatusOf({ bookingStatus, refundAmount, refundedOn }: RefundState): RefundStatus | null {
  if (bookingStatus !== "Cancelled" || !(refundAmount > 0)) return null;
  return refundedOn ? "Refunded" : "Refund due";
}

/** The money a cancelled booking keeps: received − refund, paid yet or not. */
export const keptAmount = ({ amountPaid, refundAmount }: Pick<Booking, "amountPaid" | "refundAmount">) => amountPaid - refundAmount;
