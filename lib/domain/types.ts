// lib/domain/types.ts
// Core booking types: what the app, the API and the database layer exchange.

export const PAYMENT_STATUSES = ["Unpaid", "Partial", "Paid"] as const;
export const BOOKING_STATUSES = ["Active", "Cancelled", "Archived"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Full Booking object — one booking document.
 * Derived fields (gross, discount %, total, balance, payment status) are
 * always computed by the server and stored with the booking.
 * Dates are DD/MM/YYYY; timestamps are ISO 8601; money is whole rupees.
 */
export interface Booking {
  bookingId: string;          // UUID — immutable primary identifier
  invoiceNumber: string;      // printed as "Invoice No."
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
  invoiceDate: string;        // DD/MM/YYYY
  dueDate: string;            // DD/MM/YYYY
  customerName: string;       // under BILL TO
  customerPhone: string;      // mobile; printed under BILL TO
  customerEmail: string;      // customer email ("" if none) — never printed; the bill is emailed here
  packageName: string;        // SERVICES title
  destination: string;        // printed in the invoice band
  batchName: string;          // BATCH column
  tripStartDate: string;      // DD/MM/YYYY
  tripEndDate: string;        // DD/MM/YYYY
  routeDescription: string;   // in parentheses in the service line
  travellers: number;         // QTY.
  ratePerPerson: number;      // RATE
  grossAmount: number;        // derived — travellers × rate
  discountAmount: number;     // DISC.
  discountPercentage: number; // derived — discount ÷ gross × 100
  totalAmount: number;        // derived — gross − discount
  amountPaid: number;         // cumulative received
  balanceAmount: number;      // derived — total − paid
  paymentStatus: PaymentStatus; // derived
  bookingStatus: BookingStatus;
  invoiceNote: string;        // printed under NOTES
  internalNotes: string;      // never printed
}

/** Values the user supplies when creating a booking. */
export interface BookingInput {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  packageName: string;
  destination: string;
  batchName: string;
  tripStartDate: string;
  tripEndDate: string;
  routeDescription: string;
  travellers: number;
  ratePerPerson: number;
  discountAmount: number;
  amountPaid: number;
  invoiceNote: string;
  internalNotes: string;
}

/** Fields the server assigns on create and never lets the user change. */
type AssignedField = "invoiceNumber" | "invoiceDate" | "dueDate";

/** What the user enters: everything but the assigned invoice number and dates. */
export type BookingDraft = Omit<BookingInput, AssignedField>;

/** The values the calculation needs. */
export type PricingInput = Pick<
  BookingInput,
  "travellers" | "ratePerPerson" | "discountAmount" | "amountPaid"
>;

/** Derived pricing values produced by calculateBookingAmounts. */
export interface BookingAmounts {
  grossAmount: number;
  discountPercentage: number;
  totalAmount: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
}

/** What a write returns (POST, PATCH, DELETE): enough to link to the booking and keep editing it. */
export type BookingRef = Pick<Booking, "bookingId" | "invoiceNumber" | "updatedAt" | "bookingStatus">;

export function bookingRefOf(booking: BookingRef): BookingRef {
  const { bookingId, invoiceNumber, updatedAt, bookingStatus } = booking;
  return { bookingId, invoiceNumber, updatedAt, bookingStatus };
}

/** What the status actions and bill download in the browser need (the row menu, the detail header). */
export type BookingActionTarget = BookingRef & Pick<Booking, "customerName">;

export function actionTargetOf(booking: BookingActionTarget): BookingActionTarget {
  return { ...bookingRefOf(booking), customerName: booking.customerName };
}

/** One ledger row: only the columns the table shows, plus what its menu needs. */
export const LEDGER_ROW_FIELDS = [
  "bookingId",
  "invoiceNumber",
  "updatedAt",
  "customerName",
  "customerPhone",
  "packageName",
  "destination",
  "batchName",
  "tripStartDate",
  "travellers",
  "totalAmount",
  "amountPaid",
  "balanceAmount",
  "paymentStatus",
  "bookingStatus",
] as const satisfies readonly (keyof Booking)[];

export type LedgerRow = Pick<Booking, (typeof LEDGER_ROW_FIELDS)[number]>;

/** One ⌘K search result. */
export const SEARCH_HIT_FIELDS = ["bookingId", "invoiceNumber", "customerName", "packageName"] as const satisfies readonly (keyof Booking)[];

export type BookingSearchHit = Pick<Booking, (typeof SEARCH_HIT_FIELDS)[number]>;

/** Response shape of the health-check endpoint. */
export interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  dbConnected: boolean;
  collectionsReady: boolean;
  totalBookings: number;
  accessCodeSet: boolean;
}
