// lib/server/db/collections.ts
// The collections, their document shapes and their indexes.
//
//   bookings     one document per booking (_id = the booking's UUID)
//   counters     yearly number sequences (invoice:{year}, expense:{year})
//   rate_limits  login attempt windows; MongoDB deletes them when they expire
//   settings     app settings: the hashed access code (_id "access")
//   payments     each change to a booking's amount paid, dated (cash collected)
//   booking_history  a row each time a booking's people, total or amount paid changed, with its bill
//   expenses     one document per expense (_id = the expense's UUID)
//   users        the team: people salaries are paid to (not logins)
//   general      the dropdown lists: destinations, packages, routes, marketing channels
//
// Collections and indexes are created once per server instance, on first use
// (idempotent), so a fresh database needs no manual setup.

import "server-only";

import { MongoServerError, type Collection, type Document } from "mongodb";
import {
  EXPENSE_KINDS,
  EXPENSE_STATUSES,
  EXPENSE_TYPE_IDS,
  type ExpenseKind,
  type ExpenseStatus,
  type ExpenseType,
  type PaidFor,
} from "@/lib/domain/expenses";
import { GENERAL_KIND_IDS, type GeneralKind } from "@/lib/domain/general";
import { ARCHIVABLE_STATUSES, type ArchivableStatus } from "@/lib/domain/records";
import type { BookingStatus, ClosedBy, PaymentStatus } from "@/lib/domain/types";
import type { HistoryEvent } from "@/lib/domain/booking-history";
import type { BillBooking } from "../pdf/content";
import { getDb } from "./client";

/** A booking as stored. Dates are BSON dates (UTC midnight for calendar dates). */
export interface BookingDoc {
  _id: string;
  invoiceNumber: string;
  invoiceYear: number;
  createdAt: Date;
  updatedAt: Date;
  invoiceDate: Date;
  dueDate: Date;
  customerName: string;
  customerPhone: string;
  /** Digits of customerPhone, for phone search. */
  customerPhoneDigits: string;
  customerEmail: string;
  packageName: string;
  destination: string;
  /** Lowercased, trimmed destination, for the filter and the destination list. */
  destinationKey: string;
  batchName: string;
  tripStartDate: Date;
  tripEndDate: Date;
  routeDescription: string;
  travellers: number;
  ratePerPerson: number;
  grossAmount: number;
  discountAmount: number;
  discountPercentage: number;
  totalAmount: number;
  amountPaid: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  invoiceNote: string;
  internalNotes: string;
  /** Non-refundable if cancelled. Absent on bookings saved before it existed (₹0). */
  slotAmount?: number;
  /** The IST day it was cancelled (UTC midnight), and what goes back. Absent or null until then. */
  cancelledOn?: Date | null;
  refundAmount?: number;
  /** The IST day the refund went back; null while still due. */
  refundedOn?: Date | null;
  /** Who closed it, and their name at the time. Absent on bookings saved before it existed. */
  closedBy?: ClosedBy;
  /** The Idempotency-Key the create request carried (unique when present). */
  idempotencyKey?: string;
}

/**
 * Money received on (or given back from) a booking, on the day it was
 * recorded. Written with the booking change it belongs to, in one
 * transaction: a new booking's amount paid, or the difference an edit makes
 * (negative for a correction downwards). Summed by day for cash collected.
 */
export interface PaymentDoc {
  _id: string;
  bookingId: string;
  /** Whole rupees, positive or negative, never 0. */
  amount: number;
  /** The IST day, as UTC midnight. */
  paidOn: Date;
  /** Where it came from: a create, an edit, or the one-time backfill of older bookings. */
  source: "create" | "edit" | "backfill";
  createdAt: Date;
}

/**
 * One row of a booking's history: the bill as it stood when its people, total
 * or amount paid changed (domain form, never queried). Never changed afterwards.
 */
export interface BookingHistoryDoc {
  _id: string;
  bookingId: string;
  /** The IST day, as UTC midnight. */
  changedOn: Date;
  bill: BillBooking;
  /** From before history was kept: not saved at the time, but rebuilt (scripts/backfill-history.mjs). */
  rebuilt?: true;
  /** A row that isn't an edit of the money, with the refund as it stood. */
  event?: HistoryEvent;
  refundAmount?: number;
  refundPaid?: boolean;
  createdAt: Date;
}

/** An expense as stored. Dates are BSON dates (UTC midnight for the expense date). */
export interface ExpenseDoc {
  _id: string;
  expenseNumber: string;
  expenseYear: number;
  expenseType: ExpenseType;
  /** Always the type's kind (lib/domain/expenses.ts), set by the server. */
  expenseKind: ExpenseKind;
  amount: number;
  expenseDate: Date;
  /** Where the money went; missing only on expenses saved before it existed. */
  paidFor?: PaidFor;
  note: string;
  status: ExpenseStatus;
  createdAt: Date;
  updatedAt: Date;
  /** The Idempotency-Key the create request carried (unique when present). */
  idempotencyKey?: string;
}

/** What team members and list items store alike (lib/server/db/named-repo.ts reads and writes them). */
export interface NamedDoc {
  _id: string;
  name: string;
  /** nameKeyOf(name): unique, so the same name can't be added twice. */
  nameKey: string;
  status: ArchivableStatus;
  createdAt: Date;
  updatedAt: Date;
  /** The Idempotency-Key the create request carried (unique when present). */
  idempotencyKey?: string;
}

/** A team member. */
export interface TeamMemberDoc extends NamedDoc {
  role: string;
  phone: string;
}

/** An item of one of the general lists. Its name is unique within its list. */
export interface GeneralItemDoc extends NamedDoc {
  kind: GeneralKind;
}

interface CounterDoc {
  _id: string;
  seq: number;
}

interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

/** The shared access code, stored only as a scrypt hash (see session/access-code.ts). */
interface SettingsDoc {
  _id: "access";
  hashedAccessCode: string;
  updatedAt: Date;
}

const NAMES = {
  bookings: "bookings",
  counters: "counters",
  rateLimits: "rate_limits",
  settings: "settings",
  payments: "payments",
  bookingHistory: "booking_history",
  expenses: "expenses",
  users: "users",
  general: "general",
} as const;

const string = { bsonType: "string" };
// The driver stores whole numbers above 2^31 as doubles, so amounts accept all three
const int = { bsonType: ["int", "long", "double"] };
const date = { bsonType: "date" };

/** Second line of defence behind the Zod schemas: shape, types and enums. */
const BOOKING_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "_id", "invoiceNumber", "invoiceYear", "createdAt", "updatedAt", "invoiceDate", "dueDate",
      "customerName", "customerPhone", "customerPhoneDigits", "customerEmail", "packageName",
      "destination", "destinationKey", "batchName", "tripStartDate", "tripEndDate", "routeDescription",
      "travellers", "ratePerPerson", "grossAmount", "discountAmount", "discountPercentage", "totalAmount",
      "amountPaid", "balanceAmount", "paymentStatus", "bookingStatus", "invoiceNote", "internalNotes",
    ],
    properties: {
      _id: string,
      invoiceNumber: string,
      invoiceYear: int,
      createdAt: date,
      updatedAt: date,
      invoiceDate: date,
      dueDate: date,
      customerName: string,
      customerPhone: string,
      customerPhoneDigits: string,
      customerEmail: string,
      packageName: string,
      destination: string,
      destinationKey: string,
      batchName: string,
      tripStartDate: date,
      tripEndDate: date,
      routeDescription: string,
      travellers: int,
      ratePerPerson: int,
      grossAmount: int,
      discountAmount: int,
      discountPercentage: int,
      totalAmount: int,
      amountPaid: int,
      balanceAmount: int,
      paymentStatus: { enum: ["Unpaid", "Partial", "Paid"] },
      bookingStatus: { enum: ["Active", "Cancelled", "Archived"] },
      invoiceNote: string,
      internalNotes: string,
      slotAmount: int,
      cancelledOn: { bsonType: ["date", "null"] },
      refundAmount: int,
      refundedOn: { bsonType: ["date", "null"] },
      closedBy: {
        bsonType: "object",
        required: ["refId", "label"],
        additionalProperties: false,
        properties: { refId: { bsonType: "string" }, label: { bsonType: "string", minLength: 1 } },
      },
      idempotencyKey: string,
    },
  },
};

const SETTINGS_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "hashedAccessCode", "updatedAt"],
    properties: {
      _id: { enum: ["access"] },
      hashedAccessCode: { bsonType: "string", pattern: "^scrypt\\$" },
      updatedAt: date,
    },
  },
};

const PAYMENT_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "bookingId", "amount", "paidOn", "source", "createdAt"],
    properties: {
      _id: string,
      bookingId: string,
      amount: { ...int, not: { enum: [0] } },
      paidOn: date,
      source: { enum: ["create", "edit", "backfill"] },
      createdAt: date,
    },
  },
};

const BOOKING_HISTORY_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "bookingId", "changedOn", "bill", "createdAt"],
    properties: {
      _id: string,
      bookingId: string,
      changedOn: date,
      bill: {
        bsonType: "object",
        required: ["invoiceNumber", "travellers", "totalAmount", "amountPaid", "balanceAmount"],
      },
      rebuilt: { bsonType: "bool" },
      event: string,
      refundAmount: int,
      refundPaid: { bsonType: "bool" },
      createdAt: date,
    },
  },
};

const EXPENSE_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "_id", "expenseNumber", "expenseYear", "expenseType", "expenseKind", "amount", "expenseDate",
      "note", "status", "createdAt", "updatedAt",
    ],
    properties: {
      _id: string,
      expenseNumber: string,
      expenseYear: int,
      expenseType: { enum: EXPENSE_TYPE_IDS },
      expenseKind: { enum: Object.keys(EXPENSE_KINDS) },
      amount: { ...int, minimum: 1 },
      expenseDate: date,
      paidFor: {
        bsonType: "object",
        required: ["refId", "label"],
        additionalProperties: false,
        properties: { refId: { bsonType: ["string", "null"] }, label: { bsonType: "string", minLength: 1 } },
      },
      note: string,
      status: { enum: EXPENSE_STATUSES },
      createdAt: date,
      updatedAt: date,
      idempotencyKey: string,
    },
  },
};

const named = {
  _id: string,
  name: { bsonType: "string", minLength: 1 },
  nameKey: { bsonType: "string", minLength: 1 },
  status: { enum: ARCHIVABLE_STATUSES },
  createdAt: date,
  updatedAt: date,
  idempotencyKey: string,
};
const NAMED_REQUIRED = ["_id", "name", "nameKey", "status", "createdAt", "updatedAt"];

const TEAM_VALIDATOR: Document = {
  $jsonSchema: { bsonType: "object", required: [...NAMED_REQUIRED, "role", "phone"], properties: { ...named, role: string, phone: string } },
};

const GENERAL_VALIDATOR: Document = {
  $jsonSchema: { bsonType: "object", required: [...NAMED_REQUIRED, "kind"], properties: { ...named, kind: { enum: GENERAL_KIND_IDS } } },
};

const STRICT = { validationLevel: "strict", validationAction: "error" } as const;

async function createIfMissing(name: string, options: Document = {}): Promise<void> {
  try {
    await (await getDb()).createCollection(name, options);
  } catch (err) {
    // 48 = NamespaceExists: already set up by an earlier instance
    if (!(err instanceof MongoServerError && err.code === 48)) throw err;
  }
}

async function setUp(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    createIfMissing(NAMES.bookings, { validator: BOOKING_VALIDATOR, ...STRICT }),
    createIfMissing(NAMES.counters),
    createIfMissing(NAMES.rateLimits),
    createIfMissing(NAMES.settings, { validator: SETTINGS_VALIDATOR, ...STRICT }),
    createIfMissing(NAMES.payments, { validator: PAYMENT_VALIDATOR, ...STRICT }),
    createIfMissing(NAMES.bookingHistory, { validator: BOOKING_HISTORY_VALIDATOR, ...STRICT }),
    createIfMissing(NAMES.expenses, { validator: EXPENSE_VALIDATOR, ...STRICT }),
    createIfMissing(NAMES.users, { validator: TEAM_VALIDATOR, ...STRICT }),
    createIfMissing(NAMES.general, { validator: GENERAL_VALIDATOR, ...STRICT }),
  ]);
  // Idempotent creates across all server instances (every collection that is created from a form)
  const idempotent = { key: { idempotencyKey: 1 }, name: "idempotencyKey_unique", unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } };
  await Promise.all([
    db.collection<BookingDoc>(NAMES.bookings).createIndexes([
      // The dashboard: what cancelled bookings keep, by the day cancelled, and refunds, by the day paid
      { key: { bookingStatus: 1, cancelledOn: 1, amountPaid: 1, refundAmount: 1 }, name: "status_cancelledOn_amounts" },
      { key: { bookingStatus: 1, refundedOn: 1, refundAmount: 1 }, name: "status_refundedOn_amount" },
      // No two bookings can ever share an invoice number
      { key: { invoiceNumber: 1 }, name: "invoiceNumber_unique", unique: true },
      // The ledger: newest first, per view (normal / archived / a status). Ends with
      // the sort's _id tie-breaker, so pages come straight off the index, unsorted
      { key: { bookingStatus: 1, createdAt: -1, _id: 1 }, name: "status_createdAt_id" },
      // The ledger's Closed by filter, newest first
      { key: { bookingStatus: 1, "closedBy.refId": 1, createdAt: -1, _id: 1 }, name: "status_closedBy_createdAt_id" },
      // Due and overdue (filter and summary): active bookings with a balance, by due date
      { key: { bookingStatus: 1, dueDate: 1 }, name: "status_dueDate_withBalance", partialFilterExpression: { balanceAmount: { $gt: 0 } } },
      // The dashboard: sales booked (invoice date) and revenue (trip start) of active
      // bookings. totalAmount is in the key, so the sums never read a document
      { key: { bookingStatus: 1, invoiceDate: 1, totalAmount: 1 }, name: "status_invoiceDate_total" },
      { key: { bookingStatus: 1, tripStartDate: 1, totalAmount: 1 }, name: "status_tripStart_total" },
      // The destination filter
      { key: { bookingStatus: 1, destinationKey: 1, createdAt: -1, _id: 1 }, name: "status_destination_createdAt_id" },
      idempotent,
    ]),
    db.collection<RateLimitDoc>(NAMES.rateLimits).createIndexes([
      // MongoDB removes a window once it has expired
      { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
    ]),
    db.collection<PaymentDoc>(NAMES.payments).createIndexes([
      // Cash collected over a period (the dashboard)
      { key: { paidOn: 1 }, name: "paidOn" },
      // A booking's payments (backfill check)
      { key: { bookingId: 1 }, name: "bookingId" },
    ]),
    db.collection<BookingHistoryDoc>(NAMES.bookingHistory).createIndexes([
      // A booking's rows, oldest first
      { key: { bookingId: 1, changedOn: 1, createdAt: 1 }, name: "bookingId_changedOn_createdAt" },
    ]),
    db.collection<ExpenseDoc>(NAMES.expenses).createIndexes([
      { key: { expenseNumber: 1 }, name: "expenseNumber_unique", unique: true },
      // The list: newest expense date first, per view; _id breaks ties, so pages come
      // off the index. Also the dashboard's expenses over a period
      { key: { status: 1, expenseDate: -1, _id: 1 }, name: "status_expenseDate_id" },
      // The Direct / Indirect filter
      { key: { status: 1, expenseKind: 1, expenseDate: -1, _id: 1 }, name: "status_kind_expenseDate_id" },
      // The type filter
      { key: { status: 1, expenseType: 1, expenseDate: -1, _id: 1 }, name: "status_type_expenseDate_id" },
      // The paid-for filter (a team member, package or channel, within its type)
      { key: { status: 1, expenseType: 1, "paidFor.refId": 1, expenseDate: -1, _id: 1 }, name: "status_type_paidFor_expenseDate_id" },
      idempotent,
    ]),
    db.collection<TeamMemberDoc>(NAMES.users).createIndexes([
      // No two team members with the same name
      { key: { nameKey: 1 }, name: "nameKey_unique", unique: true },
      // The Salary dropdown (active, by name)
      { key: { status: 1, nameKey: 1 }, name: "status_nameKey" },
      // The Settings list (active or archived, newest first)
      { key: { status: 1, createdAt: -1, _id: 1 }, name: "status_createdAt_id" },
      idempotent,
    ]),
    db.collection<GeneralItemDoc>(NAMES.general).createIndexes([
      // No two items with the same name in one list
      { key: { kind: 1, nameKey: 1 }, name: "kind_nameKey_unique", unique: true },
      // Each dropdown (active, by name) and each Settings list (active or archived, by name)
      { key: { kind: 1, status: 1, nameKey: 1 }, name: "kind_status_nameKey" },
      idempotent,
    ]),
  ]);
}

let ready: Promise<void> | undefined;

/** Creates collections and indexes once per server instance (retried after a failure). */
export function ensureDatabase(): Promise<void> {
  ready ??= setUp().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

export async function bookingsCollection(): Promise<Collection<BookingDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<BookingDoc>(NAMES.bookings);
}

export async function countersCollection(): Promise<Collection<CounterDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<CounterDoc>(NAMES.counters);
}

export async function rateLimitsCollection(): Promise<Collection<RateLimitDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<RateLimitDoc>(NAMES.rateLimits);
}

export async function bookingHistoryCollection(): Promise<Collection<BookingHistoryDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<BookingHistoryDoc>(NAMES.bookingHistory);
}

export async function paymentsCollection(): Promise<Collection<PaymentDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<PaymentDoc>(NAMES.payments);
}

export async function expensesCollection(): Promise<Collection<ExpenseDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<ExpenseDoc>(NAMES.expenses);
}

export async function usersCollection(): Promise<Collection<TeamMemberDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<TeamMemberDoc>(NAMES.users);
}

export async function generalCollection(): Promise<Collection<GeneralItemDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<GeneralItemDoc>(NAMES.general);
}

export async function settingsCollection(): Promise<Collection<SettingsDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<SettingsDoc>(NAMES.settings);
}
