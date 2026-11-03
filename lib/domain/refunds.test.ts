import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { keptAmount, refundPercent, refundQuote, refundStatusOf, refundWorking } from "./refunds";

const TODAY = "03/11/2026";
const figures = (days: number, over = {}) => ({ totalAmount: 20_000, amountPaid: 20_000, slotAmount: 0, tripStartDate: addDays(TODAY, days), ...over });

describe("refundPercent", () => {
  it.each([[60, 75], [30, 75], [29, 50], [14, 50], [13, 25], [7, 25], [6, 0], [0, 0], [-3, 0]])("%i days before the trip: %i%%", (days, percent) => {
    expect(refundPercent(days)).toBe(percent);
  });
});

describe("refundQuote", () => {
  it("is the percentage of the package amount when fully paid", () => {
    expect(refundQuote(figures(35), TODAY)).toMatchObject({ days: 35, percent: 75, byTerms: 15_000, limit: 20_000, amount: 15_000 });
    expect(refundQuote(figures(20), TODAY).amount).toBe(10_000);
    expect(refundQuote(figures(10), TODAY).amount).toBe(5_000);
    expect(refundQuote(figures(3), TODAY).amount).toBe(0);
    expect(refundQuote(figures(-1), TODAY).amount).toBe(0);
  });

  it("keeps the slot amount back", () => {
    expect(refundQuote(figures(35, { slotAmount: 5_000 }), TODAY).amount).toBe(15_000);
    expect(refundQuote(figures(35, { slotAmount: 8_000 }), TODAY).amount).toBe(12_000);
  });

  it("never gives back more than was received, less the slot amount", () => {
    expect(refundQuote(figures(35, { amountPaid: 10_000, slotAmount: 5_000 }), TODAY).amount).toBe(5_000);
    expect(refundQuote(figures(35, { amountPaid: 5_000, slotAmount: 5_000 }), TODAY).amount).toBe(0);
    expect(refundQuote(figures(35, { amountPaid: 3_000, slotAmount: 5_000 }), TODAY)).toMatchObject({ limit: 0, amount: 0 });
    expect(refundQuote(figures(35, { amountPaid: 0 }), TODAY).amount).toBe(0);
  });

  it("works in whole rupees", () => {
    expect(refundQuote(figures(35, { totalAmount: 10_001, amountPaid: 10_001 }), TODAY).amount).toBe(7_500);
  });
});

describe("refundWorking", () => {
  it("says how it was worked out", () => {
    const f = figures(35, { amountPaid: 10_000, slotAmount: 5_000 });
    expect(refundWorking(refundQuote(f, TODAY), f)).toBe("The trip starts in 35 days: 75% of ₹20,000 = ₹15,000. The most that can go back: ₹10,000 received − ₹5,000 slot = ₹5,000.");
    const late = figures(3);
    expect(refundWorking(refundQuote(late, TODAY), late)).toContain("no refund under the terms");
  });
});

describe("refundStatusOf and keptAmount", () => {
  it("names a cancelled booking's refund only", () => {
    expect(refundStatusOf({ bookingStatus: "Cancelled", refundAmount: 2_000, refundedOn: null })).toBe("Refund due");
    expect(refundStatusOf({ bookingStatus: "Cancelled", refundAmount: 2_000, refundedOn: TODAY })).toBe("Refunded");
    expect(refundStatusOf({ bookingStatus: "Cancelled", refundAmount: 0, refundedOn: null })).toBeNull();
    expect(refundStatusOf({ bookingStatus: "Active", refundAmount: 2_000, refundedOn: null })).toBeNull();
  });
  it("keeps what wasn't refunded", () => {
    expect(keptAmount({ amountPaid: 3_000, refundAmount: 2_000 })).toBe(1_000);
  });
});
