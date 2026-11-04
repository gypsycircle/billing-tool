import { describe, expect, it } from "vitest";
import { billNoteCounts, bookingDraftSchema, bookingFormSchema, createBookingSchema, invoiceDateChoices, invoiceDateIssue, tripEndIssue, tripStartIssue, updateBookingSchema } from "./booking.schema";
import type { BookingInput } from "./types";

const sample: BookingInput = {
  packageType: "Group",
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
  it("says a date left empty is required, and one that isn't a date is invalid", () => {
    const message = (tripStartDate: string) => createBookingSchema.safeParse({ ...sample, tripStartDate }).error?.issues.find((i) => i.path[0] === "tripStartDate")?.message;
    expect(message("")).toBe("Trip start date is required.");
    expect(message("   ")).toBe("Trip start date is required.");
    expect(message("31/02/2026")).toBe("Trip start date must be a valid date (DD/MM/YYYY).");
  });

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

  it("is today, yesterday or the day before only", () => {
    const refused = "Invoice date must be today, yesterday or the day before.";
    expect(invoiceDateChoices(today)).toEqual([today, "12/01/2026", "11/01/2026"]);
    expect(invoiceDateIssue(today, today)).toBeNull();
    expect(invoiceDateIssue("12/01/2026", today)).toBeNull();
    expect(invoiceDateIssue("11/01/2026", today)).toBeNull();
    expect(invoiceDateIssue("14/01/2026", today)).toBe(refused);
    expect(invoiceDateIssue("10/01/2026", today)).toBe(refused);
    expect(invoiceDateIssue("31/12/2025", "01/01/2026")).toBeNull();
    expect(invoiceDateIssue("30/12/2025", "01/01/2026")).toBeNull();
    expect(invoiceDateIssue("29/12/2025", "01/01/2026")).toBe(refused);
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

describe("the bill note's limit", () => {
  const words = (n: number) => Array.from({ length: n }, () => "note").join(" ");
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `Line ${i}`).join("\n");
  const noteIssue = (input: unknown) => updateBookingSchema.safeParse(input).error?.issues.find((i) => i.path[0] === "invoiceNote")?.message;

  it("counts words and printed lines, blank lines aside", () => {
    expect(billNoteCounts("")).toEqual({ words: 0, lines: 0 });
    expect(billNoteCounts("  One two\n\nthree ")).toEqual({ words: 3, lines: 2 });
  });

  it("allows 25 words and 3 lines, and no more, when a note is sent", () => {
    expect(noteIssue({ invoiceNote: words(25) })).toBeUndefined();
    expect(noteIssue({ invoiceNote: words(26) })).toContain("25 words");
    expect(noteIssue({ invoiceNote: lines(3) })).toBeUndefined();
    expect(noteIssue({ invoiceNote: lines(4) })).toContain("3 lines");
  });

  it("the form lets an older, longer note stay unchanged, but holds a changed one to the limit", () => {
    const saved = words(40);
    const issueWith = (invoiceNote: string) => bookingFormSchema({ saved: { invoiceNote } }).safeParse({ ...sample, closedById: "7f9c2ba4-e88f-4d6f-8a3e-2f1b6c3d4e5f", invoiceNote: saved }).error?.issues.find((i) => i.path[0] === "invoiceNote");
    expect(issueWith(saved)).toBeUndefined();
    expect(issueWith("something else")?.message).toContain("25 words");
  });

  it("the full record, read when any other field is edited, takes an older longer note", () => {
    expect(createBookingSchema.safeParse({ ...sample, invoiceNote: words(40) }).success).toBe(true);
  });
});

describe("package type and slot amount", () => {
  const issue = (over: object, field: string) => createBookingSchema.safeParse({ ...sample, ...over }).error?.issues.find((i) => i.path[0] === field)?.message;

  it("needs a type", () => {
    expect(issue({ packageType: undefined }, "packageType")).toBe("Choose the package type.");
    expect(issue({ packageType: "Solo" }, "packageType")).toBe("Choose the package type.");
  });

  it("a group package can have any slot amount, from ₹0", () => {
    expect(issue({ packageType: "Group", slotAmount: 0 }, "slotAmount")).toBeUndefined();
    expect(issue({ packageType: "Group", slotAmount: 2_000 }, "slotAmount")).toBeUndefined();
  });

  it("a private package can only have ₹0", () => {
    expect(issue({ packageType: "Private", slotAmount: 0 }, "slotAmount")).toBeUndefined();
    expect(issue({ packageType: "Private", slotAmount: 1 }, "slotAmount")).toBe("A private package has no slot amount.");
  });

  it.each(["amountPaid", "slotAmount", "ratePerPerson", "discountAmount"])("%s can't be negative", (field) => {
    expect(issue({ [field]: -200 }, field)).toContain("cannot be negative");
  });
});
