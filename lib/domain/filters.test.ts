import { describe, expect, it } from "vitest";
import { hasActiveFilters, parseBookingFilters } from "./filters";

const none = parseBookingFilters({});

describe("parseBookingFilters", () => {
  it("drops unknown values and keeps valid ones", () => {
    expect(parseBookingFilters({ payment: "Paid", status: "Nope", archived: "1", q: ["  goa ", "x"] })).toEqual({
      q: "goa",
      destination: "",
      payment: "Paid",
      status: undefined,
      archived: true,
      due: undefined,
      page: 1,
    });
  });

  it("reads the due filter and page number", () => {
    expect(parseBookingFilters({ due: "overdue", page: "3" })).toMatchObject({ due: "overdue", page: 3 });
    expect(parseBookingFilters({ due: "week" }).due).toBe("week");
    expect(parseBookingFilters({ due: "later" }).due).toBeUndefined();
    for (const page of ["0", "-2", "1.5", "abc", "9999999", ""]) {
      expect(parseBookingFilters({ page }).page).toBe(1);
    }
  });

  it("caps search length", () => {
    expect(parseBookingFilters({ q: "a".repeat(500) }).q).toHaveLength(100);
  });

  it("knows when filters are active", () => {
    expect(hasActiveFilters(none)).toBe(false);
    expect(hasActiveFilters(parseBookingFilters({ q: "x" }))).toBe(true);
    expect(hasActiveFilters(parseBookingFilters({ due: "week" }))).toBe(true);
    expect(hasActiveFilters(parseBookingFilters({ page: "2" }))).toBe(false);
  });
});
