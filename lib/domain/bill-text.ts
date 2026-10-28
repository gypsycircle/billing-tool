// lib/domain/bill-text.ts
// Wording exactly as it appears on the Bill of Supply. Shared by the booking
// detail screen and the PDF, so both always say the same thing.

import { formatTripDate } from "./dates";
import type { Booking } from "./types";

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
