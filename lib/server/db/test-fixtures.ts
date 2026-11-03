// lib/server/db/test-fixtures.ts
// Records for database tests, stored as they are (no service rules applied).

import { addDays, todayIST } from "@/lib/domain/dates";
import { paidForOf, type ExpenseType } from "@/lib/domain/expenses";
import type { Booking } from "@/lib/domain/types";

/** A plain active, unpaid booking; override what the test is about. */
export function booking(overrides: Partial<Booking>): Booking {
  return {
    bookingId: "a",
    invoiceNumber: "INV_20260143",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    invoiceDate: "05/01/2026",
    dueDate: "20/01/2026",
    customerName: "Adarsh Kumar",
    customerPhone: "+91 96335 69936",
    customerEmail: "",
    packageName: "Delhi - Agra Package",
    destination: "Delhi",
    batchName: "19th Jan Delhi",
    tripStartDate: "03/02/2026",
    tripEndDate: "08/02/2026",
    routeDescription: "",
    travellers: 2,
    ratePerPerson: 1_000,
    grossAmount: 2_000,
    discountAmount: 0,
    discountPercentage: 0,
    totalAmount: 2_000,
    amountPaid: 0,
    balanceAmount: 2_000,
    paymentStatus: "Unpaid",
    bookingStatus: "Active",
    invoiceNote: "",
    internalNotes: "",
    slotAmount: 0,
    cancelledOn: null,
    refundAmount: 0,
    refundedOn: null,
    closedBy: { refId: LIST_IDS.member, label: "Ravi Kumar" },
    ...overrides,
  };
}

/** Stores bookings as given, bypassing the service (fixed dates, any status). */
export async function seedBookings(bookings: Booking[]): Promise<void> {
  const { bookingsCollection } = await import("./collections");
  const { toBookingDoc } = await import("./mapping");
  await (await bookingsCollection()).insertMany(bookings.map((b) => toBookingDoc(b)));
}

/** What the booking form sends for a new booking: trip in a month, ₹20,000, ₹5,000 paid. */
export function bookingDraft() {
  const today = todayIST();
  return {
    closedById: LIST_IDS.member,
    customerName: "Adarsh",
    customerPhone: "9633569936",
    customerEmail: "Adarsh@Example.com",
    packageName: "Delhi - Agra Package",
    destination: "Delhi",
    batchName: "Batch A",
    tripStartDate: addDays(today, 30),
    tripEndDate: addDays(today, 34),
    routeDescription: "Agra-Delhi",
    travellers: 2,
    ratePerPerson: 10_000,
    discountAmount: 0,
    amountPaid: 5_000,
    invoiceNote: "",
    internalNotes: "",
  };
}

/** Fixed IDs of what seedLists stores, so tests can pick them. */
export const LIST_IDS = {
  member: "11111111-1111-4111-8111-111111111111",
  destination: "22222222-2222-4222-8222-222222222222",
  package: "33333333-3333-4333-8333-333333333333",
  route: "44444444-4444-4444-8444-444444444444",
  marketing: "55555555-5555-4555-8555-555555555555",
} as const;

/**
 * A team member and one item in each list, matching bookingDraft() and the
 * booking fixture (Delhi, "Delhi - Agra Package", "Agra-Delhi"), stored as
 * they are. Run after clearing the database.
 */
export async function seedLists(): Promise<void> {
  const { generalCollection, usersCollection } = await import("./collections");
  const now = new Date();
  const named = (id: string, name: string) => ({ _id: id, name, nameKey: name.toLowerCase(), status: "Active" as const, createdAt: now, updatedAt: now });
  await (await usersCollection()).insertOne({ ...named(LIST_IDS.member, "Ravi Kumar"), role: "Guide", phone: "" });
  await (await generalCollection()).insertMany([
    { ...named(LIST_IDS.destination, "Delhi"), kind: "destination" },
    { ...named(LIST_IDS.package, "Delhi - Agra Package"), kind: "package" },
    { ...named(LIST_IDS.route, "Agra-Delhi"), kind: "route" },
    { ...named(LIST_IDS.marketing, "Meta Ads"), kind: "marketing" },
  ]);
}

/** The form's "paid for" fields for a type, picking what seedLists stored (text types get "Guide expense"). */
export function paidForFields(type: ExpenseType): { paidForId: string; paidForText: string } {
  const source = paidForOf(type).source;
  if (source === "text") return { paidForId: "", paidForText: "Guide expense" };
  return { paidForId: source === "team" ? LIST_IDS.member : LIST_IDS[source], paidForText: "" };
}
