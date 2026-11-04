import { describe, expect, it } from "vitest";
import { bookingFilterCount, paymentFilterOptions, bookingFilterParams, hasActiveFilters, parseBookingFilters } from "./filters";

const none = parseBookingFilters({});

describe("parseBookingFilters", () => {
  it("drops unknown values and keeps valid ones", () => {
    expect(parseBookingFilters({ payment: "Paid", status: "Nope", archived: "1", q: ["  goa ", "x"] })).toEqual({
      q: "goa",
      package: "",
      payment: "Paid",
      status: "Active",
      archived: true,
      due: undefined,
      tripFrom: "",
      tripTo: "",
      bookedFrom: "",
      bookedTo: "",
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
    // Active unless Cancelled is asked for; archived bookings have their own view
    expect(parseBookingFilters({}).status).toBe("Active");
    expect(parseBookingFilters({ status: "Archived" }).status).toBe("Active");
    expect(parseBookingFilters({ status: "Cancelled" }).status).toBe("Cancelled");
    // Only a cancelled booking has a refund, and only an active one has anything due
    expect(parseBookingFilters({ payment: "Refunded" }).payment).toBeUndefined();
    expect(parseBookingFilters({ status: "Cancelled", payment: "Refund due" }).payment).toBe("Refund due");
    expect(parseBookingFilters({ status: "Cancelled", due: "overdue" }).due).toBeUndefined();
    // Active is the default: not a filter, and not in links
    expect(hasActiveFilters(parseBookingFilters({ status: "Active" }))).toBe(false);
    expect(hasActiveFilters(parseBookingFilters({ status: "Cancelled" }))).toBe(true);
    expect(bookingFilterParams(parseBookingFilters({ status: "Active" })).status).toBe("");
    expect(bookingFilterParams(parseBookingFilters({ status: "Cancelled" })).status).toBe("Cancelled");
    // The archived view narrows by them too
    expect(parseBookingFilters({ archived: "1", due: "overdue", payment: "Paid" })).toMatchObject({ archived: true, status: "Active", due: "overdue", payment: "Paid" });
  });

  it("offers refunds in the cancelled list, payment statuses otherwise", () => {
    expect(paymentFilterOptions("Cancelled")).toEqual(["Refund due", "Refunded", "No refund"]);
    expect(paymentFilterOptions("Active")).toEqual(["Unpaid", "Partial", "Paid"]);
    // A choice that isn't offered (an old link) is dropped
    expect(parseBookingFilters({ status: "Cancelled", payment: "Partial" }).payment).toBeUndefined();
    expect(parseBookingFilters({ status: "Cancelled", archived: "1", payment: "Refunded" }).payment).toBeUndefined();
    expect(parseBookingFilters({ status: "Cancelled", archived: "1", payment: "Partial" }).payment).toBe("Partial");
  });

  it("reads the booked date, and ignores one that isn't a real date", () => {
    expect(parseBookingFilters({ bookedFrom: "2026-02-01" }).bookedFrom).toBe("01/02/2026");
    expect(parseBookingFilters({ bookedTo: "2026-02-30" }).bookedTo).toBe("");
    expect(parseBookingFilters({ bookedFrom: "01/02/2026" }).bookedFrom).toBe("");
    expect(bookingFilterParams(parseBookingFilters({ bookedFrom: "2026-02-01", bookedTo: "2026-02-03" }))).toMatchObject({ bookedFrom: "2026-02-01", bookedTo: "2026-02-03" });
    expect(bookingFilterParams(none).bookedFrom).toBe("");
    // A reversed range is dropped, each on its own; the old names are ignored
    expect(parseBookingFilters({ bookedFrom: "2026-02-03", bookedTo: "2026-02-01", tripFrom: "2026-03-01" })).toMatchObject({ bookedFrom: "", bookedTo: "", tripFrom: "01/03/2026" });
    expect(hasActiveFilters(parseBookingFilters({ from: "2026-02-01", to: "2026-02-03", booked: "2026-02-01" }))).toBe(false);
  });

  it("counts the filters applied", () => {
    const count = (params: Record<string, string>) => bookingFilterCount(parseBookingFilters(params));
    // The trip status always counts: Active is chosen by default
    expect(count({})).toBe(1);
    expect(count({ status: "Cancelled" })).toBe(1);
    // A search isn't a filter
    expect(count({ q: "asha" })).toBe(1);
    // A range's two ends are one
    expect(count({ tripFrom: "2026-02-01", tripTo: "2026-02-28" })).toBe(2);
    expect(count({ tripTo: "2026-02-28" })).toBe(2);
    // The archived view has no trip status, so an old link's is ignored and not counted
    expect(parseBookingFilters({ status: "Cancelled", archived: "1" }).status).toBe("Active");
    expect(count({ archived: "1" })).toBe(1);
    expect(count({ package: "Goa", payment: "Paid", status: "Cancelled", archived: "1", bookedFrom: "2026-02-01", tripFrom: "2026-02-01" })).toBe(5);
    expect(count({ package: "Goa", status: "Cancelled", bookedFrom: "2026-02-01", bookedTo: "2026-02-03", tripFrom: "2026-02-01" })).toBe(4);
    // What the server ignores isn't counted
    expect(count({ payment: "Refunded", due: "nonsense", closedBy: "nobody" })).toBe(1);
    expect(count({ status: "Cancelled", due: "overdue" })).toBe(1);
  });

  it("caps search length", () => {
    expect(parseBookingFilters({ q: "a".repeat(500) }).q).toHaveLength(100);
  });

  it("knows when filters are active", () => {
    expect(hasActiveFilters(none)).toBe(false);
    expect(hasActiveFilters(parseBookingFilters({ q: "x" }))).toBe(true);
    expect(hasActiveFilters(parseBookingFilters({ due: "week" }))).toBe(true);
    expect(hasActiveFilters(parseBookingFilters({ bookedFrom: "2026-02-01" }))).toBe(true);
    expect(hasActiveFilters(parseBookingFilters({ page: "2" }))).toBe(false);
  });
});
