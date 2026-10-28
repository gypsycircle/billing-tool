// lib/server/db/collections.ts
// The collections, their document shapes and their indexes.
//
//   bookings     one document per booking (_id = the booking's UUID)
//   counters     invoice-number sequences, one per calendar year
//   rate_limits  login attempt windows; MongoDB deletes them when they expire
//   settings     app settings: the hashed access code (_id "access")
//
// Collections and indexes are created once per server instance, on first use
// (idempotent), so a fresh database needs no manual setup.

import "server-only";

import { MongoServerError, type Collection, type Document } from "mongodb";
import type { BookingStatus, PaymentStatus } from "@/lib/domain/types";
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
  /** The Idempotency-Key the create request carried (unique when present). */
  idempotencyKey?: string;
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

const NAMES = { bookings: "bookings", counters: "counters", rateLimits: "rate_limits", settings: "settings" } as const;

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
    createIfMissing(NAMES.bookings, { validator: BOOKING_VALIDATOR, validationLevel: "strict", validationAction: "error" }),
    createIfMissing(NAMES.counters),
    createIfMissing(NAMES.rateLimits),
    createIfMissing(NAMES.settings, { validator: SETTINGS_VALIDATOR, validationLevel: "strict", validationAction: "error" }),
  ]);
  await Promise.all([
    db.collection<BookingDoc>(NAMES.bookings).createIndexes([
      // No two bookings can ever share an invoice number
      { key: { invoiceNumber: 1 }, name: "invoiceNumber_unique", unique: true },
      // The ledger: newest first, per view (normal / archived / a status). Ends with
      // the sort's _id tie-breaker, so pages come straight off the index, unsorted
      { key: { bookingStatus: 1, createdAt: -1, _id: 1 }, name: "status_createdAt_id" },
      // Due and overdue (filter and summary): active bookings with a balance, by due date
      { key: { bookingStatus: 1, dueDate: 1 }, name: "status_dueDate_withBalance", partialFilterExpression: { balanceAmount: { $gt: 0 } } },
      // The destination filter
      { key: { bookingStatus: 1, destinationKey: 1, createdAt: -1, _id: 1 }, name: "status_destination_createdAt_id" },
      // The destination list: one index entry per destination, no documents read
      { key: { destinationKey: 1, destination: 1 }, name: "destinationKey_destination" },
      // Idempotent creates across all server instances
      { key: { idempotencyKey: 1 }, name: "idempotencyKey_unique", unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
    ]),
    db.collection<RateLimitDoc>(NAMES.rateLimits).createIndexes([
      // MongoDB removes a window once it has expired
      { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
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

export async function settingsCollection(): Promise<Collection<SettingsDoc>> {
  await ensureDatabase();
  return (await getDb()).collection<SettingsDoc>(NAMES.settings);
}
