import { describe, expect, it } from "vitest";
import { amountToWords } from "./words";

describe("amountToWords", () => {
  it.each([
    [0, "Zero Rupees"],
    [1, "One Rupee"],
    [15, "Fifteen Rupees"],
    [40, "Forty Rupees"],
    [100, "One Hundred Rupees"],
    [999, "Nine Hundred Ninety Nine Rupees"],
    [1_000, "One Thousand Rupees"],
    [40_000, "Forty Thousand Rupees"],
    [1_00_000, "One Lakh Rupees"],
    [3_10_000, "Three Lakh Ten Thousand Rupees"],
    [3_50_000, "Three Lakh Fifty Thousand Rupees"],
    [12_34_567, "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees"],
    [1_00_00_000, "One Crore Rupees"],
    [99_99_99_999, "Ninety Nine Crore Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine Rupees"],
    [1_25_00_00_000, "One Hundred Twenty Five Crore Rupees"],
  ])("%i → %s", (amount, words) => {
    expect(amountToWords(amount)).toBe(words);
  });
});
