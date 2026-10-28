// lib/domain/invoice-number.ts
// Invoice numbers are INV_{year}{number}: the calendar year of the invoice
// date, then a counter of at least 4 digits that starts again every year at
// the configured first number (INV_20260143, INV_20260144, … INV_202610000).
// The server assigns them from a per-year counter when a booking is saved.

const MIN_DIGITS = 4;

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `INV_${year}${String(sequence).padStart(MIN_DIGITS, "0")}`;
}

/**
 * The sequence the next booking of a year gets: one after the last one issued,
 * or `firstNumber` when the year has none yet.
 * @param lastIssued the year's counter value, or null if it doesn't exist yet
 */
export function nextSequence(lastIssued: number | null, firstNumber: number): number {
  return lastIssued === null ? firstNumber : lastIssued + 1;
}
