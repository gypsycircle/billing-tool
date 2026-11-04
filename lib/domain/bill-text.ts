// lib/domain/bill-text.ts
// Wording exactly as it appears on the Bill of Supply. Shared by the booking
// detail screen and the PDF, so both always say the same thing.

import { formatDisplayDate, formatTripDate } from "./dates";
import { formatAmount } from "./money";
import { keptAmount, type BillCancellation } from "./refunds";
import type { Booking } from "./types";

/** Under the package name; nothing on a booking saved before it had a type. */
export const packageTypeLabel = (packageType: Booking["packageType"] | undefined): string | null => (packageType ? `${packageType} package` : null);

/** Under NOTES when a booking has none. */
export const NO_NOTE = "No note on this bill.";

/** The notice on a cancelled booking's page: what it keeps, in rupees. */
export function cancelledNotice(booking: Pick<Booking, "amountPaid" | "refundAmount">): string {
  const kept = `₹${formatAmount(keptAmount(booking))}`;
  const refund = booking.refundAmount > 0 ? ` after the ₹${formatAmount(booking.refundAmount)} refund` : "";
  return `This booking is cancelled. Only the ${kept} it keeps${refund} counts in the figures.`;
}

/**
 * The line under the package name, e.g.
 * "Starts from 19th jan 2026 and ends at 24th jan 2026 ( Agra-delhi-Manali-Kasol )"
 */
export function serviceDescription(
  booking: Pick<Booking, "tripStartDate" | "tripEndDate" | "routeDescription">
): string {
  const base = `Starts from ${formatTripDate(booking.tripStartDate)} and ends at ${formatTripDate(booking.tripEndDate)}`;
  const route = booking.routeDescription.trim();
  return route ? `${base} ( ${route} )` : base;
}

/** QTY. column, e.g. "40 PERSON". */
export function quantityLabel(travellers: number): string {
  return `${travellers} PERSON`;
}

/** Under the discount amount, e.g. "(12.5%)". */
export function discountPercentLabel(discountPercentage: number): string {
  return `(${discountPercentage}%)`;
}

/** The seal on a cancelled bill: "CANCELLED", then its date and, once paid, the refund's. */
export function cancelledSealLines({ cancelledOn, refundedOn }: BillCancellation): { title: string; lines: string[] } {
  return {
    title: "CANCELLED",
    lines: [...(cancelledOn ? [`on ${formatDisplayDate(cancelledOn)}`] : []), ...(refundedOn ? [`Refund paid ${formatDisplayDate(refundedOn)}`] : [])],
  };
}

/** The refund's line in a cancelled bill's totals. */
export function refundLabel({ refundAmount, refundedOn }: BillCancellation): string {
  if (refundedOn) return "Refund Paid";
  return refundAmount > 0 ? "Refund Due" : "Refund";
}

/** What the business keeps of a cancelled booking, on its bill. */
export const CANCELLATION_CHARGE_LABEL = "Cancellation Charge";

/** What the bill spells out: the total, or on a cancelled bill the refund. */
export function billWords(totalAmount: number, cancellation: BillCancellation | null | undefined): { amount: number; label: string } {
  return cancellation ? { amount: cancellation.refundAmount, label: `${refundLabel(cancellation)} (in words)` } : { amount: totalAmount, label: "Total amount (in words)" };
}

/** A part of a file name: Latin letters and digits, joined by hyphens. Accents are simplified; anything else goes. */
const fileNamePart = (text: string, max: number): string =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");

/** A downloaded bill's name: "Afraq-26-12-2026-WINTER-SPITI.pdf" (customer, trip start, package). Safe in a file name and a header. */
export function billFileName({ customerName, tripStartDate, packageName }: Pick<Booking, "customerName" | "tripStartDate" | "packageName">): string {
  const parts = [fileNamePart(customerName, 60), fileNamePart(tripStartDate, 10), fileNamePart(packageName, 60)].filter(Boolean);
  return `${parts.join("-") || "Bill-of-Supply"}.pdf`;
}
