// lib/domain/types.ts
// Core booking types: what the app, the API and the database layer exchange.

export const PAYMENT_STATUSES = ["Unpaid", "Partial", "Paid"] as const;
export const BOOKING_STATUSES = ["Active", "Cancelled", "Archived"] as const;

/** Group packages take a non-refundable slot amount; private ones have none. */
export const PACKAGE_TYPES = ["Group", "Private"] as const;

export type PackageType = (typeof PACKAGE_TYPES)[number];
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
  customerEmail: string;      // customer email ("" if none) — never printed
  packageName: string;        // SERVICES title
  packageType: PackageType | null; // printed under it; null on bookings saved before it existed, until their next edit
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
  slotAmount: number;         // non-refundable if cancelled; always 0 on a private package — never printed
  balanceAmount: number;      // derived — total − paid
  paymentStatus: PaymentStatus; // derived
  bookingStatus: BookingStatus;
  invoiceNote: string;        // printed under NOTES
  internalNotes: string;      // never printed
  cancelledOn: string | null; // DD/MM/YYYY — the day it was cancelled
  refundAmount: number;       // what goes back; cancelled bookings only
  refundedOn: string | null;  // DD/MM/YYYY — the day it went back; null while still due
  refundedAt: string | null;  // ISO 8601 — the moment it was marked paid; null on refunds marked before this was kept
  closedBy: ClosedBy | null;  // who closed it — never printed; null on bookings saved before it existed
}

/** The team member who closed a booking, and their name at the time. */
export interface ClosedBy {
  refId: string;
  label: string;
}

/**
 * The Closed by dropdown: active Sales team members by name (value = ID), plus
 * the booking's own person if they aren't any more (it saves unchanged).
 */
export function closedByChoices(team: readonly { id: string; name: string }[], saved: ClosedBy | null = null): Record<string, string> {
  const choices: Record<string, string> = Object.fromEntries(team.map(({ id, name }) => [id, name]));
  if (saved && !(saved.refId in choices)) choices[saved.refId] = `${saved.label} · Not in the list`;
  return choices;
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
  packageType: PackageType;
  destination: string;
  batchName: string;
  tripStartDate: string;
  tripEndDate: string;
  routeDescription: string;
  travellers: number;
  ratePerPerson: number;
  discountAmount: number;
  amountPaid: number;
  slotAmount: number;
  invoiceNote: string;
  internalNotes: string;
}

/** Fields the server assigns on create and never lets the user change. */
type AssignedField = "invoiceNumber" | "invoiceDate" | "dueDate";

/** What the rules on what the user enters read: everything but the assigned invoice number and dates. */
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
export type BookingActionTarget = BookingRef & Pick<Booking, "customerName" | "tripStartDate" | "totalAmount" | "amountPaid" | "slotAmount" | "packageType" | "refundedOn">;

export function actionTargetOf(booking: BookingActionTarget): BookingActionTarget {
  const { customerName, tripStartDate, totalAmount, amountPaid, slotAmount, packageType, refundedOn } = booking;
  return { ...bookingRefOf(booking), customerName, tripStartDate, totalAmount, amountPaid, slotAmount, packageType, refundedOn };
}

/** One ledger row: only the columns the table shows, plus what its menu needs. */
export const LEDGER_ROW_FIELDS = [
  "bookingId",
  "closedBy",
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
  "slotAmount",
  "packageType",
  "refundAmount",
  "refundedOn",
] as const satisfies readonly (keyof Booking)[];

export type LedgerRow = Pick<Booking, (typeof LEDGER_ROW_FIELDS)[number]>;

/** Response shape of the health-check endpoint. */
export interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  dbConnected: boolean;
  collectionsReady: boolean;
  totalBookings: number;
  accessCodeSet: boolean;
}
