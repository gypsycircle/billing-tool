import { describe, expect, it } from "vitest";
import { bookingDraftSchema, bookingFormSchema, createBookingSchema, invoiceDateIssue, tripEndIssue, tripStartIssue, updateBookingSchema } from "./booking.schema";
import type { BookingInput } from "./types";

const sample: BookingInput = {
  slotAmount: 0,
  invoiceNumber: "142",
  invoiceDate: "13/01/2026",
  dueDate: "12/02/2026",
  customerName: "Test Customer",
  customerPhone: "9000000000",
  customerEmail: "",
  packageName: "DELHI - AGRA PACKAGE",
  destination: "Delhi",
  batchName: "19TH JAN DELHI",
  tripStartDate: "19/01/2026",
  tripEndDate: "24/01/2026",
  routeDescription: "Agra-delhi-Manali-Kasol",
  travellers: 40,
  ratePerPerson: 10_000,
  discountAmount: 50_000,
  amountPaid: 40_000,
  invoiceNote: "COMPLIMENTARY FOR 5 PAX HAS BEEN ADDED.",
  internalNotes: "",
};

/** What the form and the API send. */
const draft = { ...sample, closedById: "11111111-1111-4111-8111-111111111111" };

function fieldErrors(input: unknown): string[] {
  const result = createBookingSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("createBookingSchema", () => {
  it("accepts the sample bill", () => {
    expect(createBookingSchema.safeParse(sample).success).toBe(true);
  });

  it("still allows formula characters inside text and a + in the phone number", () => {
    const result = createBookingSchema.safeParse({ ...sample, customerPhone: "+91 96335 69936", invoiceNote: "Pickup at 6 - 7 am @ Kozhikode" });
    expect(result.success).toBe(true);
  });

  it("trims text fields", () => {
    const result = createBookingSchema.parse({ ...sample, customerName: "  Test  " });
    expect(result.customerName).toBe("Test");
  });

  it.each<[Partial<BookingInput>, string]>([
    [{ discountAmount: 4_00_001 }, "discountAmount"],
    [{ amountPaid: 3_50_001 }, "amountPaid"],
    [{ dueDate: "12/01/2026" }, "dueDate"],
    [{ tripEndDate: "18/01/2026" }, "tripEndDate"],
    [{ invoiceDate: "31/02/2026" }, "invoiceDate"],
    [{ ratePerPerson: 999.5 }, "ratePerPerson"],
    [{ travellers: 0 }, "travellers"],
    [{ customerPhone: "abc" }, "customerPhone"],
    [{ customerName: "   " }, "customerName"],
    [{ invoiceNumber: "=SUM(A1)" }, "invoiceNumber"],
    [{ invoiceNumber: "-143" }, "invoiceNumber"],
    [{ customerName: "=HYPERLINK(\"http://x\")" }, "customerName"],
    [{ packageName: "+cmd|' /C calc'!A0" }, "packageName"],
    [{ invoiceNote: "-2+3" }, "invoiceNote"],
    [{ internalNotes: "  @SUM(1)" }, "internalNotes"],
  ])("rejects %o", (change, field) => {
    expect(fieldErrors({ ...sample, ...change })).toContain(field);
  });
});

describe("customer email", () => {
  it("is optional, trimmed and stored lowercased", () => {
    expect(createBookingSchema.safeParse({ ...sample, customerEmail: "" }).success).toBe(true);
    expect(createBookingSchema.parse({ ...sample, customerEmail: "  Meera.K@Example.COM " }).customerEmail).toBe("meera.k@example.com");
  });

  it("refuses an address that isn't an email", () => {
    for (const email of ["meera", "meera@", "@example.com", "meera example.com"]) {
      const issues = createBookingSchema.safeParse({ ...sample, customerEmail: email }).error?.issues ?? [];
      expect(issues.map((i) => i.path.join(".")), email).toContain("customerEmail");
    }
  });

  it("can be changed on its own, and a PATCH without it leaves it alone", () => {
    expect(updateBookingSchema.parse({ customerEmail: "new@example.com" })).toEqual({ customerEmail: "new@example.com" });
    expect(updateBookingSchema.parse({ amountPaid: 1000 })).not.toHaveProperty("customerEmail");
  });
});

describe("updateBookingSchema", () => {
  it("accepts a partial change", () => {
    expect(updateBookingSchema.safeParse({ amountPaid: 50_000 }).success).toBe(true);
  });

  it("rejects unknown keys such as derived fields", () => {
    expect(updateBookingSchema.safeParse({ totalAmount: 1 }).success).toBe(false);
    expect(updateBookingSchema.safeParse({ bookingStatus: "Archived" }).success).toBe(false);
  });

  it("rejects an empty update", () => {
    expect(updateBookingSchema.safeParse({}).success).toBe(false);
  });

  it("rejects the assigned invoice number and dates", () => {
    expect(updateBookingSchema.safeParse({ invoiceNumber: "INV_20260150" }).success).toBe(false);
    expect(updateBookingSchema.safeParse({ invoiceDate: "13/01/2026" }).success).toBe(false);
    expect(updateBookingSchema.safeParse({ dueDate: "13/01/2026" }).success).toBe(false);
  });
});

describe("bookingDraftSchema", () => {
  it("keeps the invoice date, and drops the assigned invoice number and due date", () => {
    const result = bookingDraftSchema.parse(draft);
    expect(result.invoiceDate).toBe(sample.invoiceDate);
    expect(result).not.toHaveProperty("invoiceNumber");
    expect(result).not.toHaveProperty("dueDate");
  });

  it("requires who closed it", () => {
    for (const closedById of ["", "not-an-id", undefined]) {
      const issue = bookingDraftSchema.safeParse({ ...draft, closedById }).error?.issues.find((i) => i.path[0] === "closedById");
      expect(issue?.message).toBe("Choose who closed this booking.");
    }
  });

  it("keeps Closed by editable and the invoice date not", () => {
    expect(updateBookingSchema.safeParse({ closedById: draft.closedById }).success).toBe(true);
    expect(updateBookingSchema.safeParse({ closedById: "" }).success).toBe(false);
  });

  it("keeps the trip and amount rules", () => {
    expect(bookingDraftSchema.safeParse({ ...draft, tripEndDate: "18/01/2026" }).success).toBe(false);
    expect(bookingDraftSchema.safeParse({ ...draft, discountAmount: 4_00_001 }).success).toBe(false);
  });

  it("reports a cross-field error together with other fields' errors", () => {
    const result = bookingDraftSchema.safeParse({ ...draft, customerName: "", ratePerPerson: Number.NaN, tripEndDate: "18/01/2026" });
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["customerName", "ratePerPerson", "tripEndDate"]));
    // A rule whose own fields are invalid stays quiet: the field errors explain it
    const amounts = bookingDraftSchema.safeParse({ ...draft, travellers: Number.NaN, discountAmount: 9_99_99_999 });
    expect(amounts.success ? [] : amounts.error.issues.map((i) => i.path.join("."))).toEqual(["travellers"]);
  });
});

describe("trip start after the invoice date", () => {
  it("accepts the next day onwards", () => {
    expect(tripStartIssue("14/01/2026", "13/01/2026")).toBeNull();
  });

  it("refuses the invoice date itself and earlier", () => {
    expect(tripStartIssue("13/01/2026", "13/01/2026")).toBe("Trip must start after the invoice date (from 14/01/2026 onwards).");
    expect(tripStartIssue("01/01/2026", "13/01/2026")).not.toBeNull();
  });

  it("is enforced by the form schema unless the saved start is unchanged", () => {
    const early = { ...draft, tripStartDate: "10/01/2026", tripEndDate: "24/01/2026" };
    const issues = bookingFormSchema().safeParse(early).error?.issues ?? [];
    expect(issues.map((i) => i.path.join("."))).toContain("tripStartDate");
    expect(bookingFormSchema({ saved: { tripStartDate: "10/01/2026" } }).safeParse(early).success).toBe(true);
  });

  it("reports the trip start even while other fields are still empty", () => {
    const partial = { ...sample, customerName: "", tripStartDate: "13/01/2026" };
    const paths = bookingFormSchema().safeParse(partial).error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toEqual(expect.arrayContaining(["customerName", "tripStartDate"]));
  });
});

describe("trip end after the invoice date", () => {
  it("accepts the next day onwards and refuses the invoice date itself", () => {
    expect(tripEndIssue("14/01/2026", "13/01/2026")).toBeNull();
    expect(tripEndIssue("13/01/2026", "13/01/2026")).toBe("Trip must end after the invoice date (from 14/01/2026 onwards).");
  });

  it("is enforced by the form schema unless the saved end is unchanged", () => {
    const past = { ...draft, tripStartDate: "10/01/2026", tripEndDate: "12/01/2026" };
    const paths = bookingFormSchema().safeParse(past).error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toEqual(expect.arrayContaining(["tripStartDate", "tripEndDate"]));
    const saved = { tripStartDate: "10/01/2026", tripEndDate: "12/01/2026" };
    expect(bookingFormSchema({ saved }).safeParse(past).success).toBe(true);
  });

  it("reports the trip end even while other fields are still empty", () => {
    const partial = { ...sample, customerName: "", tripEndDate: "13/01/2026" };
    const paths = bookingFormSchema().safeParse(partial).error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toEqual(expect.arrayContaining(["customerName", "tripEndDate"]));
  });
});

describe("invoice date of a new booking", () => {
  const today = "13/01/2026";

  it("is today or yesterday only", () => {
    expect(invoiceDateIssue(today, today)).toBeNull();
    expect(invoiceDateIssue("12/01/2026", today)).toBeNull();
    expect(invoiceDateIssue("14/01/2026", today)).toBe("Invoice date must be today or yesterday.");
    expect(invoiceDateIssue("11/01/2026", today)).toBe("Invoice date must be today or yesterday.");
    expect(invoiceDateIssue("31/12/2025", "01/01/2026")).toBeNull();
  });

  it("is checked by the create form only", () => {
    const old = { ...draft, invoiceDate: "01/01/2026" };
    const paths = bookingFormSchema({ today }).safeParse(old).error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toContain("invoiceDate");
    expect(bookingFormSchema().safeParse(old).success).toBe(true);
  });

  it("moves the first day a trip can start", () => {
    const startsToday = { ...draft, tripStartDate: today };
    expect(bookingFormSchema({ today }).safeParse({ ...startsToday, invoiceDate: "12/01/2026" }).success).toBe(true);
    const paths = bookingFormSchema({ today }).safeParse({ ...startsToday, invoiceDate: today }).error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toContain("tripStartDate");
  });
});
