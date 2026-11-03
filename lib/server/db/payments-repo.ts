// lib/server/db/payments-repo.ts
// Payment entries: each change to a booking's amount paid, dated, so cash
// collected can be summed over any period. Written only together with the
// booking change they belong to (bookings-repo.ts, in one transaction).

import "server-only";

import type { ClientSession } from "mongodb";
import { paymentsCollection, type PaymentDoc } from "./collections";
import { toDate } from "./mapping";

/**
 * The entry for a change of `amount` rupees on `paidOn` (DD/MM/YYYY, IST),
 * or null when nothing changed.
 */
export function paymentEntry(bookingId: string, amount: number, paidOn: string, source: PaymentDoc["source"]): PaymentDoc | null {
  if (amount === 0) return null;
  return { _id: crypto.randomUUID(), bookingId, amount, paidOn: toDate(paidOn), source, createdAt: new Date() };
}

export async function insertPayment(entry: PaymentDoc, session: ClientSession): Promise<void> {
  await (await paymentsCollection()).insertOne(entry, { session });
}
