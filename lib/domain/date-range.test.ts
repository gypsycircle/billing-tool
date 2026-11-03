import { describe, expect, it } from "vitest";
import { dateRangeParams, expenseDatePresets, orderedRange, presetOf, tripDatePresets } from "./date-range";
import { parseExpenseFilters } from "./expense-filters";
import { parseBookingFilters } from "./filters";

// Thursday 29 October 2026
const TODAY = "29/10/2026";

const ranges = (presets: { label: string; from: string; to: string }[]) => presets.map((p) => `${p.label}: ${p.from}–${p.to}`);

describe("quick picks", () => {
  it("offers trips ahead for bookings (by trip start)", () => {
    expect(ranges(tripDatePresets(TODAY))).toEqual([
      "This week: 26/10/2026–01/11/2026",
      "This month: 01/10/2026–31/10/2026",
      "Next month: 01/11/2026–30/11/2026",
      "Next 3 months: 01/11/2026–31/01/2027",
      "Last month: 01/09/2026–30/09/2026",
    ]);
  });

  it("offers spending so far for expenses", () => {
    expect(ranges(expenseDatePresets(TODAY))).toEqual([
      "Today: 29/10/2026–29/10/2026",
      "Yesterday: 28/10/2026–28/10/2026",
      "Last 7 days: 23/10/2026–29/10/2026",
      "This month: 01/10/2026–29/10/2026",
      "Last month: 01/09/2026–30/09/2026",
      "This year: 01/01/2026–29/10/2026",
      "Last year: 01/01/2025–31/12/2025",
    ]);
  });

  it("gives each pick an id, and finds the pick a range is exactly", () => {
    const presets = tripDatePresets(TODAY);
    expect(presets.map((p) => p.id)).toEqual(["this-week", "this-month", "next-month", "next-3-months", "last-month"]);
    expect(presetOf(presets, { from: "01/11/2026", to: "30/11/2026" })?.id).toBe("next-month");
    expect(presetOf(presets, { from: "01/11/2026", to: "29/11/2026" })).toBeUndefined();
    expect(presetOf(presets, { from: "", to: "" })).toBeUndefined();
  });

  it("starts the week on Monday, also on a Sunday or a Monday", () => {
    expect(tripDatePresets("01/11/2026")[0]).toMatchObject({ from: "26/10/2026", to: "01/11/2026" });
    expect(tripDatePresets("02/11/2026")[0]).toMatchObject({ from: "02/11/2026", to: "08/11/2026" });
  });
});

describe("the range in the URL", () => {
  it("keeps a range or an open end, and drops a reversed one", () => {
    expect(orderedRange({ from: "01/10/2026", to: "31/10/2026" })).toEqual({ from: "01/10/2026", to: "31/10/2026" });
    expect(orderedRange({ from: "01/10/2026", to: "" })).toEqual({ from: "01/10/2026", to: "" });
    expect(orderedRange({ from: "31/10/2026", to: "01/10/2026" })).toEqual({ from: "", to: "" });
  });

  it("is read from YYYY-MM-DD by both lists, and written back the same way", () => {
    const bookings = parseBookingFilters({ from: "2026-10-01", to: "2026-10-31" });
    expect([bookings.from, bookings.to]).toEqual(["01/10/2026", "31/10/2026"]);
    expect(dateRangeParams(bookings)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    const expenses = parseExpenseFilters({ from: "2026-02-30", to: ["2026-10-31", "2026-11-30"] });
    expect([expenses.from, expenses.to]).toEqual(["", "31/10/2026"]);
    expect(parseBookingFilters({ from: "2026-11-01", to: "2026-10-01" })).toMatchObject({ from: "", to: "" });
  });
});
