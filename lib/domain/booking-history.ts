// lib/domain/booking-history.ts
// A booking's history: one row each time its people, total or amount received
// changed, or it was cancelled, reactivated or refunded, holding how things stood
// at that moment. Other edits (dates, place, names, notes) add no row. Each row's
// change and payment are worked out by comparing it with the row before.

import { formatAmount } from "./money";
import type { Booking } from "./types";

/** What makes a new row when it changes. */
const TRACKED = ["amountPaid", "travellers", "totalAmount"] as const;

export type TrackedFigures = Pick<Booking, (typeof TRACKED)[number]>;

export const historyChanged = (before: TrackedFigures, saved: TrackedFigures): boolean => TRACKED.some((field) => before[field] !== saved[field]);

/** A row that isn't an edit of the money. */
export type HistoryEvent = "cancelled" | "reactivated" | "refund-changed" | "refund-paid" | "refund-undone";

export interface HistoryEntry extends TrackedFigures, Pick<Booking, "balanceAmount" | "refundAmount"> {
  entryId: string;
  /** DD/MM/YYYY (IST). */
  changedOn: string;
  /** From before history was kept: its bill was estimated, not saved at the time. */
  rebuilt: boolean;
  event: HistoryEvent | null;
  /** The refund had gone back by this row. */
  refundPaid: boolean;
}

export interface HistoryRow extends HistoryEntry {
  /** "Booking created", "1 person added · Payment", … */
  change: string;
  /** The money this row added: negative for a correction down or a refund, 0 when none moved. */
  payment: number;
  /** What had been received by this row, less any refund paid. */
  received: number;
  /** Still owed at this row; null once cancelled, when nothing is. */
  balance: number | null;
}

const people = (count: number) => (count === 1 ? "1 person" : `${count} people`);

const EVENT_TEXT: Record<HistoryEvent, (entry: HistoryEntry) => string> = {
  cancelled: ({ refundAmount }) => (refundAmount > 0 ? `Cancelled · ₹${formatAmount(refundAmount)} to refund` : "Cancelled"),
  reactivated: () => "Reactivated",
  "refund-changed": ({ refundAmount }) => `Refund changed to ₹${formatAmount(refundAmount)}`,
  "refund-paid": () => "Refund paid",
  "refund-undone": () => "Refund paid undone",
};

function changeBetween(before: HistoryEntry, entry: HistoryEntry): string {
  if (entry.event) return EVENT_TEXT[entry.event](entry);
  const parts: string[] = [];
  const added = entry.travellers - before.travellers;
  if (added !== 0) parts.push(`${people(Math.abs(added))} ${added > 0 ? "added" : "removed"}`);
  else if (entry.totalAmount !== before.totalAmount) parts.push("Total changed");
  if (entry.amountPaid !== before.amountPaid) parts.push(entry.amountPaid > before.amountPaid ? "Payment" : "Correction");
  return parts.join(" · ") || "Updated";
}

const receivedAt = (entry: HistoryEntry) => entry.amountPaid - (entry.refundPaid ? entry.refundAmount : 0);

/** `entries` oldest first; the rows newest first. */
export function bookingHistory(entries: readonly HistoryEntry[]): HistoryRow[] {
  const rows = entries.map((entry, i): HistoryRow => {
    const before = entries[i - 1];
    const received = receivedAt(entry);
    const balance = entry.event && entry.event !== "reactivated" ? null : entry.balanceAmount;
    return before
      ? { ...entry, change: changeBetween(before, entry), payment: received - receivedAt(before), received, balance }
      : { ...entry, change: "Booking created", payment: received, received, balance };
  });
  return rows.reverse();
}
