import { describe, expect, it } from "vitest";
import { amountToWords, limitWords, wordCount } from "./words";

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

describe("wordCount and limitWords", () => {
  it("counts words, whatever the spacing", () => {
    expect([wordCount(""), wordCount("   "), wordCount(" one  two\nthree ")]).toEqual([0, 0, 3]);
  });

  it("lets a text grow up to the limit", () => {
    expect(limitWords("a b c", "a b", 3)).toBe("a b c");
    expect(limitWords("a b c ", "a b c", 3)).toBe("a b c ");
  });

  it("refuses more typing at the limit", () => {
    expect(limitWords("a b c d", "a b c ", 3)).toBe("a b c ");
  });

  it("keeps a paste's first words, its lines included", () => {
    expect(limitWords("a b\nc d e", "", 3)).toBe("a b\nc");
    expect(limitWords("a x y z", "a", 3)).toBe("a x y");
  });

  it("lets a longer saved text be changed or cut down, never grow", () => {
    expect(limitWords("a b c d", "a b c d e", 3)).toBe("a b c d");
    expect(limitWords("a b c X e", "a b c d e", 3)).toBe("a b c X e");
    expect(limitWords("a b c d e f", "a b c d e", 3)).toBe("a b c d e");
  });
});
