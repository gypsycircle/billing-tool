// components/bookings/booking-form/defaults.ts
// Starting values for the booking form. Plain module (no "use client") so
// server pages can build them.

import type { z } from "zod";
import type { bookingDraftSchema } from "@/lib/domain/booking.schema";
import { routeFormValues } from "@/lib/domain/general";
import type { Booking } from "@/lib/domain/types";

/** What the form holds while editing (before Zod trims/validates). */
export type BookingFormInput = z.input<typeof bookingDraftSchema>;
/** What the form submits (validated). */
export type BookingFormValues = z.output<typeof bookingDraftSchema>;

/**
 * The invoice number and dates. For a new booking the number is the expected
 * one, the date is today and the due date is "".
 */
export interface InvoiceInfo {
  number: string;
  date: string;
  dueDate: string;
}

/** A new booking, dated today. Numbers start as NaN = "not entered yet". */
export function newBookingDefaults(today: string): BookingFormInput {
  return {
    invoiceDate: today,
    closedById: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    packageName: "",
    destination: "",
    batchName: "",
    tripStartDate: "",
    tripEndDate: "",
    routeDescription: "",
    routeOther: "",
    travellers: 1,
    ratePerPerson: Number.NaN,
    discountAmount: 0,
    amountPaid: 0,
    slotAmount: 0,
    // Nothing chosen yet: the form asks for it before it saves
    packageType: "" as BookingFormInput["packageType"],
    invoiceNote: "",
    internalNotes: "",
  };
}

/** A saved booking's invoice number and dates. */
export function invoiceInfoOf(booking: Booking): InvoiceInfo {
  return { number: booking.invoiceNumber, date: booking.invoiceDate, dueDate: booking.dueDate };
}

/** The editable fields of a saved booking; `routeNames` is the Routes list. */
export function bookingFormDefaults(booking: Booking, routeNames: readonly string[]): BookingFormInput {
  return {
    invoiceDate: booking.invoiceDate,
    closedById: booking.closedBy?.refId ?? "",
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail,
    packageName: booking.packageName,
    destination: booking.destination,
    batchName: booking.batchName,
    tripStartDate: booking.tripStartDate,
    tripEndDate: booking.tripEndDate,
    ...routeFormValues(booking.routeDescription, routeNames),
    travellers: booking.travellers,
    ratePerPerson: booking.ratePerPerson,
    discountAmount: booking.discountAmount,
    amountPaid: booking.amountPaid,
    slotAmount: booking.slotAmount,
    packageType: booking.packageType ?? ("" as BookingFormInput["packageType"]),
    invoiceNote: booking.invoiceNote,
    internalNotes: booking.internalNotes,
  };
}
