import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import type { PackageType } from "./types";
import { keptAmount, refundPercent, refundQuote, refundStatusOf, refundWorking } from "./refunds";

const TODAY = "03/11/2026";
const figures = (days: number, over = {}) => ({ totalAmount: 20_000, amountPaid: 20_000, slotAmount: 0, packageType: "Group" as PackageType | null, tripStartDate: addDays(TODAY, days), ...over });

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

describe("refunds by package type", () => {
  // Package ₹20,000, ₹10,000 received; group with a ₹2,000 slot, private with none
  const group = (days: number) => figures(days, { amountPaid: 10_000, slotAmount: 2_000 });
  const privately = (days: number) => figures(days, { amountPaid: 10_000, packageType: "Private" });

  it.each([
    ["30 days or more: 75%", 35, 15_000, 8_000, 10_000],
    ["14 to 29 days: 50%", 20, 10_000, 8_000, 10_000],
    ["7 to 13 days: 25%", 10, 5_000, 5_000, 5_000],
    ["under 7 days: none", 3, 0, 0, 0],
  ])("%s", (_band, days, byTerms, groupAmount, privateAmount) => {
    expect(refundQuote(group(days), TODAY)).toMatchObject({ byTerms, limit: 8_000, amount: groupAmount });
    expect(refundQuote(privately(days), TODAY)).toMatchObject({ byTerms, limit: 10_000, amount: privateAmount });
  });

  it("says the limit each way, and goes by the saved slot on an older booking with no type", () => {
    expect(refundWorking(refundQuote(group(35), TODAY), group(35))).toContain("At most ₹8,000 can go back (₹2,000 slot kept).");
    expect(refundWorking(refundQuote(privately(35), TODAY), privately(35))).toContain("At most ₹10,000 can go back.");
    const older = figures(35, { amountPaid: 10_000, slotAmount: 2_000, packageType: null });
    expect(refundQuote(older, TODAY).amount).toBe(8_000);
  });
});

describe("refundWorking", () => {
  it("says how it was worked out", () => {
    const f = figures(35, { amountPaid: 10_000, slotAmount: 5_000 });
    expect(refundWorking(refundQuote(f, TODAY), f)).toBe("The trip starts in 35 days: 75% of ₹20,000 = ₹15,000. At most ₹5,000 can go back (₹5,000 slot kept).");
    const fullyPaid = figures(35);
    expect(refundWorking(refundQuote(fullyPaid, TODAY), fullyPaid)).toBe("The trip starts in 35 days: 75% of ₹20,000 = ₹15,000.");
    const late = figures(3);
    expect(refundWorking(refundQuote(late, TODAY), late)).toBe("The trip starts in 3 days: no refund under the terms.");
  });
});

describe("refundStatusOf and keptAmount", () => {
  it("names a cancelled booking's refund only", () => {
    expect(refundStatusOf({ bookingStatus: "Cancelled", refundAmount: 2_000, refundedOn: null })).toBe("Refund due");
    expect(refundStatusOf({ bookingStatus: "Cancelled", refundAmount: 2_000, refundedOn: TODAY })).toBe("Refunded");
    expect(refundStatusOf({ bookingStatus: "Cancelled", refundAmount: 0, refundedOn: null })).toBe("No refund");
    expect(refundStatusOf({ bookingStatus: "Active", refundAmount: 2_000, refundedOn: null })).toBeNull();
  });
  it("keeps what wasn't refunded", () => {
    expect(keptAmount({ amountPaid: 3_000, refundAmount: 2_000 })).toBe(1_000);
  });
});
