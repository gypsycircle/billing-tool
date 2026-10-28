// lib/server/pdf/content.ts
// The booking values the Bill of Supply prints, as text, from one booking.
// Amounts come from the booking's computed values only (worked out by the
// service on every save), so every repeated position agrees.

import "server-only";

import { discountPercentLabel, quantityLabel, serviceDescription } from "@/lib/domain/bill-text";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatAmount } from "@/lib/domain/money";
import type { Booking } from "@/lib/domain/types";
import { amountToWords } from "@/lib/domain/words";

/** Everything the bill prints. Statuses, the email and internal notes never appear. */
export const BILL_FIELDS = [
  "invoiceNumber",
  "invoiceDate",
  "dueDate",
  "destination",
  "customerName",
  "customerPhone",
  "packageName",
  "batchName",
  "tripStartDate",
  "tripEndDate",
  "routeDescription",
  "travellers",
  "ratePerPerson",
  "discountAmount",
  "discountPercentage",
  "totalAmount",
  "amountPaid",
  "balanceAmount",
  "invoiceNote",
] as const satisfies readonly (keyof Booking)[];

export type BillBooking = Pick<Booking, (typeof BILL_FIELDS)[number]>;

export interface BillContent {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  destination: string;
  customerName: string;
  customerPhone: string;
  /** "10 Nov 2026 – 17 Nov 2026", as on the booking page. */
  tripDates: string;
  batchName: string;
  packageName: string;
  serviceDescription: string;
  quantity: string;
  rate: string;
  discount: string;
  discountPercent: string;
  amount: string;
  subtotalQuantity: string;
  totalAmount: string;
  receivedAmount: string;
  balance: string;
  amountInWords: string;
  /** Paragraphs of the invoice note (the booking page keeps its line breaks). */
  note: string[];
}

/** One line of text: newlines and runs of spaces become single spaces. */
const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

export function billContent(b: BillBooking): BillContent {
  return {
    invoiceNumber: oneLine(b.invoiceNumber),
    invoiceDate: b.invoiceDate,
    dueDate: b.dueDate,
    destination: oneLine(b.destination),
    customerName: oneLine(b.customerName),
    customerPhone: oneLine(b.customerPhone),
    tripDates: `${formatDisplayDate(b.tripStartDate)} – ${formatDisplayDate(b.tripEndDate)}`,
    batchName: oneLine(b.batchName),
    // The services table prints the package and batch in capitals, like the booking page
    packageName: oneLine(b.packageName).toUpperCase(),
    serviceDescription: oneLine(serviceDescription({ ...b, routeDescription: oneLine(b.routeDescription) })),
    quantity: quantityLabel(b.travellers),
    rate: formatAmount(b.ratePerPerson),
    discount: formatAmount(b.discountAmount),
    discountPercent: discountPercentLabel(b.discountPercentage),
    amount: formatAmount(b.totalAmount),
    subtotalQuantity: String(b.travellers),
    totalAmount: formatAmount(b.totalAmount),
    receivedAmount: formatAmount(b.amountPaid),
    balance: formatAmount(b.balanceAmount),
    amountInWords: amountToWords(b.totalAmount),
    note: b.invoiceNote
      .split(/\r?\n/)
      .map(oneLine)
      .filter(Boolean),
  };
}
