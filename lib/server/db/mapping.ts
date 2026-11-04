// lib/server/db/mapping.ts
// Domain records (DD/MM/YYYY strings, ISO timestamps) ↔ stored documents
// (BSON dates): Booking ↔ BookingDoc, Expense ↔ ExpenseDoc, and team members
// and list items. The only place the two shapes meet; everything above the
// repositories works with the domain types.

import "server-only";

import { getYear } from "date-fns";
import type { Document } from "mongodb";
import { formatDDMMYYYY, parseDDMMYYYY } from "@/lib/domain/dates";
import type { Expense } from "@/lib/domain/expenses";
import type { GeneralItem } from "@/lib/domain/general";
import { nameKeyOf, type NamedRecord } from "@/lib/domain/named-records";
import type { TeamMember } from "@/lib/domain/team";
import type { Booking } from "@/lib/domain/types";
import type { BookingDoc, ExpenseDoc, GeneralItemDoc, NamedDoc, TeamMemberDoc } from "./collections";

/** A DD/MM/YYYY date as a UTC-midnight Date. Throws on an invalid date (callers validate first). */
export function toDate(value: string): Date {
  const date = parseDDMMYYYY(value);
  if (!date) throw new Error("Invalid DD/MM/YYYY date");
  return date;
}

/** A date-range filter ({ from, to }, DD/MM/YYYY, "" open) as a query on a stored date; null when both ends are open. */
export function withinDays({ from, to }: { from: string; to: string }): { $gte?: Date; $lte?: Date } | null {
  if (!from && !to) return null;
  return { ...(from ? { $gte: toDate(from) } : {}), ...(to ? { $lte: toDate(to) } : {}) };
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
    packageKey: nameKeyOf(booking.packageName),
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
    slotAmount: booking.slotAmount,
    ...(booking.packageType ? { packageType: booking.packageType } : {}),
    cancelledOn: booking.cancelledOn ? toDate(booking.cancelledOn) : null,
    refundAmount: booking.refundAmount,
    refundedOn: booking.refundedOn ? toDate(booking.refundedOn) : null,
    refundedAt: booking.refundedAt ? new Date(booking.refundedAt) : null,
    ...(booking.closedBy ? { closedBy: booking.closedBy } : {}),
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
    slotAmount: doc.slotAmount ?? 0,
    packageType: doc.packageType ?? null,
    cancelledOn: doc.cancelledOn ? formatDDMMYYYY(doc.cancelledOn) : null,
    refundAmount: doc.refundAmount ?? 0,
    refundedOn: doc.refundedOn ? formatDDMMYYYY(doc.refundedOn) : null,
    refundedAt: doc.refundedAt ? doc.refundedAt.toISOString() : null,
    closedBy: doc.closedBy ?? null,
  };
}

/** A full booking read: everything but the storage-only search and idempotency fields. */
export const BOOKING_PROJECTION = {
  customerPhoneDigits: 0,
  destinationKey: 0,
  packageKey: 0,
  invoiceYear: 0,
  idempotencyKey: 0,
} as const satisfies Document;

/**
 * Partial reads of one record type: `projectionOf(fields)` fetches only those
 * fields (the record's ID field is the document's _id), and `pickFromDoc`
 * turns the fetched document into those domain fields (dates to DD/MM/YYYY,
 * timestamps to ISO).
 */
function partialReads<Domain extends object, Doc extends { _id: string }>(
  idField: keyof Domain,
  calendarDates: readonly (keyof Domain)[],
  timestamps: readonly (keyof Domain)[]
) {
  const calendar = new Set(calendarDates);
  const stamps = new Set(timestamps);
  return {
    projectionOf(fields: readonly (keyof Domain)[]): Document {
      return Object.fromEntries(fields.map((field) => [field === idField ? "_id" : field, 1]));
    },
    pickFromDoc<K extends keyof Domain>(doc: Partial<Doc>, fields: readonly K[]): Pick<Domain, K> {
      const picked: Partial<Record<keyof Domain, unknown>> = {};
      for (const field of fields) {
        const value = field === idField ? doc._id : doc[field as unknown as keyof Doc];
        picked[field] =
          calendar.has(field) ? (value ? formatDDMMYYYY(value as unknown as Date) : null)
          : stamps.has(field) ? (value as Date).toISOString()
          : value;
      }
      return picked as Pick<Domain, K>;
    },
  };
}

export const bookingReads = partialReads<Booking, BookingDoc>(
  "bookingId",
  ["invoiceDate", "dueDate", "tripStartDate", "tripEndDate", "cancelledOn", "refundedOn"],
  ["createdAt", "updatedAt"]
);

/** The editable fields of a booking as a $set update (derived fields included). */
export function bookingUpdateSet(booking: Booking): Partial<BookingDoc> {
  const { _id, invoiceNumber, invoiceYear, createdAt, idempotencyKey, ...rest } = toBookingDoc(booking);
  void _id; void invoiceNumber; void invoiceYear; void createdAt; void idempotencyKey;
  return rest;
}

// ── Expenses ──────────────────────────────────────────────────────────────

export function toExpenseDoc(expense: Expense, idempotencyKey?: string): ExpenseDoc {
  const expenseDate = toDate(expense.expenseDate);
  return {
    _id: expense.expenseId,
    expenseNumber: expense.expenseNumber,
    expenseYear: getYear(expenseDate),
    expenseType: expense.expenseType,
    expenseKind: expense.expenseKind,
    amount: expense.amount,
    expenseDate,
    ...(expense.paidFor ? { paidFor: expense.paidFor } : {}),
    note: expense.note,
    status: expense.status,
    createdAt: new Date(expense.createdAt),
    updatedAt: new Date(expense.updatedAt),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

export function fromExpenseDoc(doc: ExpenseDoc): Expense {
  return {
    expenseId: doc._id,
    expenseNumber: doc.expenseNumber,
    expenseType: doc.expenseType,
    expenseKind: doc.expenseKind,
    amount: doc.amount,
    expenseDate: formatDDMMYYYY(doc.expenseDate),
    paidFor: doc.paidFor ?? null,
    note: doc.note,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** A full expense read: everything but the storage-only fields. */
export const EXPENSE_PROJECTION = { expenseYear: 0, idempotencyKey: 0 } as const satisfies Document;

export const expenseReads = partialReads<Expense, ExpenseDoc>("expenseId", ["expenseDate"], ["createdAt", "updatedAt"]);

/** The editable fields of an expense as a $set update (its kind follows its type). */
export function expenseUpdateSet(expense: Expense): Pick<ExpenseDoc, "expenseType" | "expenseKind" | "amount" | "expenseDate" | "paidFor" | "note" | "updatedAt"> {
  const { expenseType, expenseKind, amount, expenseDate, paidFor, note, updatedAt } = toExpenseDoc(expense);
  return { expenseType, expenseKind, amount, expenseDate, paidFor, note, updatedAt };
}

// ── Team members and list items ───────────────────────────────────────────

function toNamedDoc(record: NamedRecord, idempotencyKey?: string): NamedDoc {
  return {
    _id: record.id,
    name: record.name,
    nameKey: nameKeyOf(record.name),
    status: record.status,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

function fromNamedDoc(doc: NamedDoc): NamedRecord {
  return { id: doc._id, name: doc.name, status: doc.status, createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString() };
}

export const toTeamMemberDoc = (member: TeamMember, idempotencyKey?: string): TeamMemberDoc => ({
  ...toNamedDoc(member, idempotencyKey),
  role: member.role,
  phone: member.phone,
});
export const fromTeamMemberDoc = (doc: TeamMemberDoc): TeamMember => ({ ...fromNamedDoc(doc), role: doc.role, phone: doc.phone });

export const toGeneralItemDoc = (item: GeneralItem, idempotencyKey?: string): GeneralItemDoc => ({
  ...toNamedDoc(item, idempotencyKey),
  kind: item.kind,
});
export const fromGeneralItemDoc = (doc: GeneralItemDoc): GeneralItem => ({ ...fromNamedDoc(doc), kind: doc.kind });
