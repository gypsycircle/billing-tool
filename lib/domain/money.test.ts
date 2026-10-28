import { describe, expect, it } from "vitest";
import { formatAmount } from "./money";

describe("formatAmount", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [1000, "1,000"],
    [50000, "50,000"],
    [350000, "3,50,000"],
    [10000000, "1,00,00,000"],
  ])("groups %i the Indian way → %s", (input, output) => {
    expect(formatAmount(input)).toBe(output);
  });

  it("rounds to whole rupees and handles negatives and non-finite values", () => {
    expect(formatAmount(1234.6)).toBe("1,235");
    expect(formatAmount(-50000)).toBe("-50,000");
    expect(formatAmount(Number.NaN)).toBe("0");
  });
});
