import { describe, expect, it } from "vitest";
import { formatInvoiceNumber, nextSequence } from "./invoice-number";

describe("formatInvoiceNumber", () => {
  it("pads the counter to at least 4 digits", () => {
    expect(formatInvoiceNumber(2026, 143)).toBe("INV_20260143");
    expect(formatInvoiceNumber(2026, 1)).toBe("INV_20260001");
    expect(formatInvoiceNumber(2026, 10_000)).toBe("INV_202610000");
  });
});

describe("nextSequence", () => {
  it("starts the year at the first number", () => {
    expect(nextSequence(null, 143)).toBe(143);
  });

  it("is one after the last number issued", () => {
    expect(nextSequence(143, 143)).toBe(144);
    expect(nextSequence(999, 143)).toBe(1000);
    expect(formatInvoiceNumber(2026, nextSequence(9999, 143))).toBe("INV_202610000");
  });
});
