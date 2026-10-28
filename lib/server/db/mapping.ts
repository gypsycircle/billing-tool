// lib/server/db/mapping.ts
// Booking (domain: DD/MM/YYYY strings, ISO timestamps) ↔ BookingDoc (BSON
// dates). The only place the two shapes meet; everything above the
// repository works with the domain Booking.

import "server-only";

import { getYear } from "date-fns";
import type { Document } from "mongodb";
import { formatDDMMYYYY, parseDDMMYYYY } from "@/lib/domain/dates";
import type { Booking } from "@/lib/domain/types";
import type { BookingDoc } from "./collections";

/** A DD/MM/YYYY date as a UTC-midnight Date. Throws on an invalid date (callers validate first). */
export function toDate(value: string): Date {
  const date = parseDDMMYYYY(value);
  if (!date) throw new Error("Invalid DD/MM/YYYY date");
  return date;
}

export const digitsOf = (value: string) => value.replace(/\D/g, "");
export const destinationKeyOf = (destination: string) => destination.trim().toLowerCase();

export function toBookingDoc(booking: Booking, idempotencyKey?: string): BookingDoc {
  const invoiceDate = toDate(booking.invoiceDate);
  return {
    _id: booking.bookingId,
    invoiceNumber: booking.invoiceNumber,
    invoiceYear: getYear(invoiceDate),
    createdAt: new Date(booking.createdAt),
    updatedAt: new Date(booking.updatedAt),
    invoiceDate,
    dueDate: toDate(booking.dueDate),
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerPhoneDigits: digitsOf(booking.customerPhone),
    customerEmail: booking.customerEmail,
    packageName: booking.packageName,
    destination: booking.destination,
    destinationKey: destinationKeyOf(booking.destination),
    batchName: booking.batchName,
    tripStartDate: toDate(booking.tripStartDate),
    tripEndDate: toDate(booking.tripEndDate),
    routeDescription: booking.routeDescription,
    travellers: booking.travellers,
    ratePerPerson: booking.ratePerPerson,
    grossAmount: booking.grossAmount,
    discountAmount: booking.discountAmount,
    discountPercentage: booking.discountPercentage,
    totalAmount: booking.totalAmount,
    amountPaid: booking.amountPaid,
    balanceAmount: booking.balanceAmount,
    paymentStatus: booking.paymentStatus,
    bookingStatus: booking.bookingStatus,
    invoiceNote: booking.invoiceNote,
    internalNotes: booking.internalNotes,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

export function fromBookingDoc(doc: BookingDoc): Booking {
  return {
    bookingId: doc._id,
    invoiceNumber: doc.invoiceNumber,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    invoiceDate: formatDDMMYYYY(doc.invoiceDate),
    dueDate: formatDDMMYYYY(doc.dueDate),
    customerName: doc.customerName,
    customerPhone: doc.customerPhone,
    customerEmail: doc.customerEmail,
    packageName: doc.packageName,
    destination: doc.destination,
    batchName: doc.batchName,
    tripStartDate: formatDDMMYYYY(doc.tripStartDate),
    tripEndDate: formatDDMMYYYY(doc.tripEndDate),
    routeDescription: doc.routeDescription,
    travellers: doc.travellers,
    ratePerPerson: doc.ratePerPerson,
    grossAmount: doc.grossAmount,
    discountAmount: doc.discountAmount,
    discountPercentage: doc.discountPercentage,
    totalAmount: doc.totalAmount,
    amountPaid: doc.amountPaid,
    balanceAmount: doc.balanceAmount,
    paymentStatus: doc.paymentStatus,
    bookingStatus: doc.bookingStatus,
    invoiceNote: doc.invoiceNote,
    internalNotes: doc.internalNotes,
  };
}

/** A full booking read: everything but the storage-only search and idempotency fields. */
export const BOOKING_PROJECTION = {
  customerPhoneDigits: 0,
  destinationKey: 0,
  invoiceYear: 0,
  idempotencyKey: 0,
} as const satisfies Document;

const CALENDAR_DATES = new Set<keyof Booking>(["invoiceDate", "dueDate", "tripStartDate", "tripEndDate"]);
const TIMESTAMPS = new Set<keyof Booking>(["createdAt", "updatedAt"]);

/** A projection that fetches only `fields` (bookingId is the document's _id). */
export function projectionOf(fields: readonly (keyof Booking)[]): Document {
  return Object.fromEntries(fields.map((field) => [field === "bookingId" ? "_id" : field, 1]));
}

/** The `fields` of a document fetched with projectionOf(fields), in domain form. */
export function pickFromDoc<K extends keyof Booking>(doc: Partial<BookingDoc>, fields: readonly K[]): Pick<Booking, K> {
  const picked: Partial<Record<keyof Booking, unknown>> = {};
  for (const field of fields) {
    const value = field === "bookingId" ? doc._id : doc[field as keyof BookingDoc];
    picked[field] =
      CALENDAR_DATES.has(field) ? formatDDMMYYYY(value as Date)
      : TIMESTAMPS.has(field) ? (value as Date).toISOString()
      : value;
  }
  return picked as Pick<Booking, K>;
}

/** The editable fields of a booking as a $set update (derived fields included). */
export function bookingUpdateSet(booking: Booking): Partial<BookingDoc> {
  const { _id, invoiceNumber, invoiceYear, createdAt, idempotencyKey, ...rest } = toBookingDoc(booking);
  void _id; void invoiceNumber; void invoiceYear; void createdAt; void idempotencyKey;
  return rest;
}
