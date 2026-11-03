import { describe, expect, it } from "vitest";
import { bookingHistory, historyChanged, type HistoryEntry } from "./booking-history";

const entry = (travellers: number, totalAmount: number, amountPaid: number, rebuilt = false): HistoryEntry => ({
  entryId: `${travellers}-${totalAmount}-${amountPaid}`,
  changedOn: "03/11/2026",
  travellers,
  totalAmount,
  amountPaid,
  balanceAmount: totalAmount - amountPaid,
  rebuilt,
  event: null,
  refundAmount: 0,
  refundPaid: false,
});

const changesOf = (...entries: HistoryEntry[]) => bookingHistory(entries).map((r) => [r.change, r.payment]).reverse();

describe("historyChanged", () => {
  const base = { travellers: 2, totalAmount: 11_000, amountPaid: 5_000 };
  it("is true when people, total or amount received change", () => {
    expect(historyChanged(base, { ...base, travellers: 3 })).toBe(true);
    expect(historyChanged(base, { ...base, totalAmount: 10_000 })).toBe(true);
    expect(historyChanged(base, { ...base, amountPaid: 6_000 })).toBe(true);
  });
  it("is false when none of them does", () => {
    expect(historyChanged(base, { ...base })).toBe(false);
  });
});

describe("bookingHistory", () => {
  it("is empty with no entries", () => {
    expect(bookingHistory([])).toEqual([]);
  });

  it("shows newest first, each row with the figures of its moment", () => {
    const rows = bookingHistory([entry(2, 11_000, 5_000), entry(3, 16_500, 8_000)]);
    expect(rows.map((r) => [r.change, r.travellers, r.totalAmount, r.payment, r.amountPaid, r.balanceAmount])).toEqual([
      ["1 person added · Payment", 3, 16_500, 3_000, 8_000, 8_500],
      ["Booking created", 2, 11_000, 5_000, 5_000, 6_000],
    ]);
  });

  it("names each kind of change", () => {
    expect(changesOf(entry(2, 11_000, 0))).toEqual([["Booking created", 0]]);
    expect(changesOf(entry(2, 11_000, 5_000), entry(2, 11_000, 9_000))[1]).toEqual(["Payment", 4_000]);
    expect(changesOf(entry(2, 11_000, 5_000), entry(2, 11_000, 4_000))[1]).toEqual(["Correction", -1_000]);
    expect(changesOf(entry(2, 11_000, 5_000), entry(3, 16_500, 5_000))[1]).toEqual(["1 person added", 0]);
    expect(changesOf(entry(2, 11_000, 5_000), entry(4, 22_000, 5_000))[1]).toEqual(["2 people added", 0]);
    expect(changesOf(entry(3, 16_500, 5_000), entry(2, 11_000, 5_000))[1]).toEqual(["1 person removed", 0]);
    expect(changesOf(entry(2, 11_000, 5_000), entry(2, 10_000, 5_000))[1]).toEqual(["Total changed", 0]);
    expect(changesOf(entry(2, 11_000, 5_000), entry(2, 10_000, 4_000))[1]).toEqual(["Total changed · Correction", -1_000]);
  });

  it("follows a cancellation and its refund", () => {
    const paid = entry(2, 11_000, 3_000);
    const cancelled = { ...paid, event: "cancelled" as const, refundAmount: 2_000 };
    const refunded = { ...cancelled, event: "refund-paid" as const, refundPaid: true };
    const undone = { ...cancelled, event: "refund-undone" as const };
    const changed = { ...cancelled, event: "refund-changed" as const, refundAmount: 1_500 };
    const back = { ...paid, event: "reactivated" as const };
    const rows = bookingHistory([paid, cancelled, changed, { ...refunded, refundAmount: 1_500 }, { ...undone, refundAmount: 1_500 }, back]).reverse();
    expect(rows.map((r) => [r.change, r.payment, r.received, r.balance])).toEqual([
      ["Booking created", 3_000, 3_000, 8_000],
      ["Cancelled · ₹2,000 to refund", 0, 3_000, null],
      ["Refund changed to ₹1,500", 0, 3_000, null],
      ["Refund paid", -1_500, 1_500, null],
      ["Refund paid undone", 1_500, 3_000, null],
      ["Reactivated", 0, 3_000, 8_000],
    ]);
    expect(bookingHistory([paid, { ...paid, event: "cancelled" }])[0].change).toBe("Cancelled");
  });

  it("keeps a rebuilt row's mark", () => {
    expect(bookingHistory([entry(2, 11_000, 5_000, true)])[0].rebuilt).toBe(true);
  });
});
