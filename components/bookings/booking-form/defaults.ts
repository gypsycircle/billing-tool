// components/bookings/booking-form/defaults.ts
// Starting values for the booking form. Plain module (no "use client") so
// server pages can build them.

import type { z } from "zod";
import type { bookingDraftSchema } from "@/lib/domain/booking.schema";
import type { Booking } from "@/lib/domain/types";

/** What the form holds while editing (before Zod trims/validates). */
export type BookingFormInput = z.input<typeof bookingDraftSchema>;
/** What the form submits (validated). */
export type BookingFormValues = z.output<typeof bookingDraftSchema>;

/**
 * The invoice number and dates, shown read-only: the server assigns them.
 * For a new booking the number is the expected one and the due date is "".
 */
export interface InvoiceInfo {
  number: string;
  date: string;
  dueDate: string;
}

/** A new booking. Numbers start as NaN = "not entered yet". */
export function newBookingDefaults(): BookingFormInput {
  return {
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    packageName: "",
    destination: "",
    batchName: "",
    tripStartDate: "",
    tripEndDate: "",
    routeDescription: "",
    travellers: 1,
    ratePerPerson: Number.NaN,
    discountAmount: 0,
    amountPaid: 0,
    invoiceNote: "",
    internalNotes: "",
  };
}

/** A saved booking's invoice number and dates. */
export function invoiceInfoOf(booking: Booking): InvoiceInfo {
  return { number: booking.invoiceNumber, date: booking.invoiceDate, dueDate: booking.dueDate };
}

/** The editable fields of a saved booking. */
export function bookingFormDefaults(booking: Booking): BookingFormInput {
  return {
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail,
    packageName: booking.packageName,
    destination: booking.destination,
    batchName: booking.batchName,
    tripStartDate: booking.tripStartDate,
    tripEndDate: booking.tripEndDate,
    routeDescription: booking.routeDescription,
    travellers: booking.travellers,
    ratePerPerson: booking.ratePerPerson,
    discountAmount: booking.discountAmount,
    amountPaid: booking.amountPaid,
    invoiceNote: booking.invoiceNote,
    internalNotes: booking.internalNotes,
  };
}
