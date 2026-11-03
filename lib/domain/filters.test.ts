import { describe, expect, it } from "vitest";
import { bookingFilterParams, hasActiveFilters, parseBookingFilters } from "./filters";

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
      from: "",
      to: "",
      booked: "",
      closedBy: "",
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

  it("keeps only the filters a view can use", () => {
    // Archived bookings have their own view, not a trip status
    expect(parseBookingFilters({ status: "Archived" }).status).toBeUndefined();
    expect(parseBookingFilters({ status: "Cancelled" }).status).toBe("Cancelled");
    // The archived view has no trip status or due date to narrow by
    expect(parseBookingFilters({ archived: "1", status: "Active", due: "overdue", payment: "Paid" })).toMatchObject({ archived: true, status: undefined, due: undefined, payment: "Paid" });
  });

  it("reads the booked date, and ignores one that isn't a real date", () => {
    expect(parseBookingFilters({ booked: "2026-02-01" }).booked).toBe("01/02/2026");
    expect(parseBookingFilters({ booked: "2026-02-30" }).booked).toBe("");
    expect(parseBookingFilters({ booked: "01/02/2026" }).booked).toBe("");
    expect(bookingFilterParams(parseBookingFilters({ booked: "2026-02-01" })).booked).toBe("2026-02-01");
    expect(bookingFilterParams(none).booked).toBe("");
  });

  it("caps search length", () => {
    expect(parseBookingFilters({ q: "a".repeat(500) }).q).toHaveLength(100);
  });

  it("knows when filters are active", () => {
    expect(hasActiveFilters(none)).toBe(false);
    expect(hasActiveFilters(parseBookingFilters({ q: "x" }))).toBe(true);
    expect(hasActiveFilters(parseBookingFilters({ due: "week" }))).toBe(true);
    expect(hasActiveFilters(parseBookingFilters({ booked: "2026-02-01" }))).toBe(true);
    expect(hasActiveFilters(parseBookingFilters({ page: "2" }))).toBe(false);
  });
});
