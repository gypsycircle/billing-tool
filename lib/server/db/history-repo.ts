// lib/server/db/history-repo.ts
// A booking's history: one document each time it changed in a way that's tracked
// (lib/domain/booking-history.ts), holding the bill as it stood then. Written only together with the
// booking change it belongs to (bookings-repo.ts, in one transaction), and never
// changed afterwards.

import "server-only";

import type { ClientSession } from "mongodb";
import { formatDDMMYYYY } from "@/lib/domain/dates";
import { isCancelledEvent, type HistoryEntry, type HistoryEvent } from "@/lib/domain/booking-history";
import type { Booking } from "@/lib/domain/types";
import { billOf, type BillBooking } from "../pdf/content";
import { bookingHistoryCollection, type BookingHistoryDoc } from "./collections";
import { toDate } from "./mapping";

/**
 * The row for `saved` (the booking as saved), on `changedOn` (DD/MM/YYYY, IST).
 * `event`: a cancellation or refund row, with the refund as it stands.
 */
export function historyEntry(bookingId: string, changedOn: string, saved: BillBooking & Pick<Booking, "bookingStatus" | "slotAmount" | "cancelledOn" | "refundAmount" | "refundedOn">, event?: HistoryEvent): BookingHistoryDoc {
  return {
    _id: crypto.randomUUID(),
    bookingId,
    changedOn: toDate(changedOn),
    bill: billOf(saved),
    slotAmount: saved.slotAmount,
    ...(event ? { event, refundAmount: saved.refundAmount, refundPaid: Boolean(saved.refundedOn) } : {}),
    createdAt: new Date(),
  };
}

export async function insertHistory(entry: BookingHistoryDoc, session: ClientSession): Promise<void> {
  await (await bookingHistoryCollection()).insertOne(entry, { session });
}

const ROW_FIGURES = { "bill.packageType": 1, "bill.travellers": 1, "bill.totalAmount": 1, "bill.amountPaid": 1, "bill.balanceAmount": 1, "bill.ratePerPerson": 1, "bill.discountAmount": 1, "bill.cancellation": 1, slotAmount: 1 };

/** A booking's rows, oldest first, with only the figures the table shows. */
export async function findHistory(bookingId: string): Promise<HistoryEntry[]> {
  const docs = await (await bookingHistoryCollection())
    .find({ bookingId }, { projection: { changedOn: 1, rebuilt: 1, event: 1, refundAmount: 1, refundPaid: 1, ...ROW_FIGURES } })
    .sort({ changedOn: 1, createdAt: 1 })
    .toArray();
  return docs.map((doc) => ({
    entryId: doc._id,
    changedOn: formatDDMMYYYY(doc.changedOn),
    rebuilt: doc.rebuilt === true,
    event: doc.event ?? null,
    refundAmount: doc.refundAmount ?? 0,
    refundPaid: doc.refundPaid === true,
    travellers: doc.bill.travellers,
    totalAmount: doc.bill.totalAmount,
    amountPaid: doc.bill.amountPaid,
    balanceAmount: doc.bill.balanceAmount,
    ratePerPerson: doc.bill.ratePerPerson,
    discountAmount: doc.bill.discountAmount,
    slotAmount: doc.slotAmount ?? null,
    packageType: doc.bill.packageType ?? null,
    cancelled: Boolean(doc.bill.cancellation) || isCancelledEvent(doc.event),
  }));
}

/** One row's bill, only if the row belongs to this booking. */
export async function findHistoryBill(bookingId: string, entryId: string): Promise<(Pick<BookingHistoryDoc, "bill" | "event" | "refundAmount" | "refundPaid"> & { changedOn: string }) | null> {
  const doc = await (await bookingHistoryCollection()).findOne({ _id: entryId, bookingId }, { projection: { changedOn: 1, bill: 1, event: 1, refundAmount: 1, refundPaid: 1 } });
  return doc ? { changedOn: formatDDMMYYYY(doc.changedOn), bill: doc.bill, event: doc.event, refundAmount: doc.refundAmount, refundPaid: doc.refundPaid } : null;
}
