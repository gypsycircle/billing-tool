import { describe, expect, it } from "vitest";
import { BookingCalculationError, calculateBookingAmounts } from "./calculations";

const base = { travellers: 40, ratePerPerson: 10_000, discountAmount: 50_000, amountPaid: 40_000 };

describe("calculateBookingAmounts", () => {
  it("matches the sample Bill of Supply", () => {
    expect(calculateBookingAmounts(base)).toEqual({
      grossAmount: 4_00_000,
      discountPercentage: 12.5,
      totalAmount: 3_50_000,
      balanceAmount: 3_10_000,
      paymentStatus: "Partial",
    });
  });

  it("is Unpaid when nothing is paid", () => {
    expect(calculateBookingAmounts({ ...base, amountPaid: 0 }).paymentStatus).toBe("Unpaid");
  });

  it("is Paid when paid equals the total", () => {
    const result = calculateBookingAmounts({ ...base, amountPaid: 3_50_000 });
    expect(result.paymentStatus).toBe("Paid");
    expect(result.balanceAmount).toBe(0);
  });

  it("handles a zero rate without dividing by zero", () => {
    const result = calculateBookingAmounts({ travellers: 5, ratePerPerson: 0, discountAmount: 0, amountPaid: 0 });
    expect(result).toMatchObject({ grossAmount: 0, discountPercentage: 0, totalAmount: 0, paymentStatus: "Unpaid" });
  });

  it("handles a full discount", () => {
    const result = calculateBookingAmounts({ ...base, discountAmount: 4_00_000, amountPaid: 0 });
    expect(result).toMatchObject({ discountPercentage: 100, totalAmount: 0, balanceAmount: 0 });
  });

  it("rounds the discount percentage to 2 decimals", () => {
    const result = calculateBookingAmounts({ travellers: 3, ratePerPerson: 1_000, discountAmount: 1_000, amountPaid: 0 });
    expect(result.discountPercentage).toBe(33.33);
  });

  it.each([
    [{ ...base, discountAmount: 4_00_001 }, "discountAmount"],
    [{ ...base, amountPaid: 3_50_001 }, "amountPaid"],
    [{ ...base, travellers: 0 }, "travellers"],
    [{ ...base, ratePerPerson: -1 }, "ratePerPerson"],
    [{ ...base, amountPaid: 10.5 }, "amountPaid"],
  ])("rejects invalid input %#", (input, field) => {
    expect(() => calculateBookingAmounts(input)).toThrow(BookingCalculationError);
    try {
      calculateBookingAmounts(input);
    } catch (err) {
      expect((err as BookingCalculationError).field).toBe(field);
    }
  });
});
