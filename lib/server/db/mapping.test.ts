import { describe, expect, it } from "vitest";
import type { Booking } from "@/lib/domain/types";
import { fromBookingDoc, toBookingDoc } from "./mapping";

const booking: Booking = {
  bookingId: "8f14e45f-ceea-4672-8d5b-7f6a2f1a0c11",
  invoiceNumber: "INV_20260143",
  createdAt: "2026-10-28T05:00:00.123Z",
  updatedAt: "2026-10-28T06:30:00.456Z",
  invoiceDate: "28/10/2026",
  dueDate: "16/11/2026",
  customerName: "Meera K",
  customerPhone: "+91 90000 11111",
  customerEmail: "meera@example.com",
  packageName: "Goa Beach Camp",
  destination: " Goa ",
  batchName: "Dec Batch",
  tripStartDate: "30/11/2026",
  tripEndDate: "04/12/2026",
  routeDescription: "",
  travellers: 2,
  ratePerPerson: 12_000,
  grossAmount: 24_000,
  discountAmount: 0,
  discountPercentage: 0,
  totalAmount: 24_000,
  amountPaid: 5_000,
  balanceAmount: 19_000,
  paymentStatus: "Partial",
  bookingStatus: "Active",
  invoiceNote: "",
  internalNotes: "VIP",
};

describe("booking ↔ document mapping", () => {
  it("stores dates as UTC-midnight dates and adds the search helpers", () => {
    const doc = toBookingDoc(booking, "key-1234567890abcdef");
    expect(doc._id).toBe(booking.bookingId);
    expect(doc.invoiceYear).toBe(2026);
    expect(doc.invoiceDate.toISOString()).toBe("2026-10-28T00:00:00.000Z");
    expect(doc.tripStartDate.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(doc.createdAt.toISOString()).toBe(booking.createdAt);
    expect(doc.customerPhoneDigits).toBe("919000011111");
    expect(doc.destinationKey).toBe("goa");
    expect(doc.idempotencyKey).toBe("key-1234567890abcdef");
  });

  it("round-trips a booking exactly, including millisecond versions", () => {
    expect(fromBookingDoc(toBookingDoc(booking))).toEqual(booking);
  });

  it("leaves the idempotency key out when there is none", () => {
    expect(toBookingDoc(booking)).not.toHaveProperty("idempotencyKey");
  });
});
