import { describe, expect, it } from "vitest";
import { formatAmount, formatCompactAmount } from "./money";

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

describe("formatCompactAmount", () => {
  it("shortens to thousands, lakhs and crores", () => {
    expect(formatCompactAmount(0)).toBe("0");
    expect(formatCompactAmount(950)).toBe("950");
    expect(formatCompactAmount(1_500)).toBe("1.5K");
    expect(formatCompactAmount(20_000)).toBe("20K");
    expect(formatCompactAmount(2_50_000)).toBe("2.5L");
    expect(formatCompactAmount(1_20_00_000)).toBe("1.2Cr");
    expect(formatCompactAmount(-45_000)).toBe("-45K");
  });
});
