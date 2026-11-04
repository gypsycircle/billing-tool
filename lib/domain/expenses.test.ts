import { describe, expect, it } from "vitest";
import { expenseDateIssue, expenseDraftSchema, expenseFormSchema, updateExpenseSchema } from "./expense.schema";
import { expenseFilterParams, parseExpenseFilters } from "./expense-filters";
import { paidForLabel, EXPENSE_TYPE_OPTIONS, expenseKindOf, formatExpenseNumber, paidForInput, paidForPreview, expenseStatusBadge } from "./expenses";

const PACKAGE_ID = "33333333-3333-4333-8333-333333333333";
const draft = { expenseType: "package_cost", amount: 25_000, expenseDate: "20/10/2026", note: "Kedarkantha camp", paidForId: PACKAGE_ID };

describe("expense types", () => {
  it("fixes each type's kind: package cost and wages are direct, the rest indirect", () => {
    expect([expenseKindOf("package_cost"), expenseKindOf("wages")]).toEqual(["direct", "direct"]);
    expect([expenseKindOf("marketing"), expenseKindOf("salary"), expenseKindOf("miscellaneous")]).toEqual([
      "indirect",
      "indirect",
      "indirect",
    ]);
    expect(EXPENSE_TYPE_OPTIONS.wages).toBe("Wages · Direct");
  });

  it("numbers expenses EXP_{year}{counter}", () => {
    expect(formatExpenseNumber(2026, 1)).toBe("EXP_20260001");
  });
});

describe("expense schemas", () => {
  it("accepts a draft and trims the note", () => {
    expect(expenseDraftSchema.parse({ ...draft, note: "  x  " }).note).toBe("x");
  });

  it.each([
    [{ expenseType: "travel" }, "expenseType"],
    [{ amount: 0 }, "amount"],
    [{ amount: 12.5 }, "amount"],
    [{ amount: 1_00_00_001 }, "amount"],
    [{ expenseDate: "31/02/2026" }, "expenseDate"],
    [{ note: "=SUM(A1)" }, "note"],
    [{ note: "x".repeat(501) }, "note"],
  ])("refuses %o on %s", (change, field) => {
    const result = expenseDraftSchema.safeParse({ ...draft, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe(field);
  });

  it("says an empty amount is required, and a non-number is not a number", () => {
    const empty = expenseDraftSchema.safeParse({ ...draft, amount: Number.NaN });
    const missing = expenseDraftSchema.safeParse({ ...draft, amount: undefined });
    const text = expenseDraftSchema.safeParse({ ...draft, amount: "12" });
    expect([empty.error?.issues[0]?.message, missing.error?.issues[0]?.message, text.error?.issues[0]?.message]).toEqual([
      "Amount spent is required.",
      "Amount spent is required.",
      "Amount spent must be a number.",
    ]);
  });

  it("refuses dates after today, and only those", () => {
    expect(expenseDateIssue("21/10/2026", "20/10/2026")).toMatch(/future/);
    expect(expenseDateIssue("20/10/2026", "20/10/2026")).toBeNull();
    expect(expenseFormSchema("19/10/2026").safeParse(draft).success).toBe(false);
  });

  it("updates take any fields the user enters, never the number, kind or status", () => {
    expect(updateExpenseSchema.safeParse({ amount: 10 }).success).toBe(true);
    for (const forbidden of [{ expenseNumber: "EXP_1" }, { expenseKind: "direct" }, { status: "Archived" }, {}]) {
      expect(updateExpenseSchema.safeParse(forbidden).success).toBe(false);
    }
  });
});

describe("paid for", () => {
  const issues = (input: Record<string, unknown>) => {
    const result = expenseDraftSchema.safeParse({ ...draft, paidForId: "", paidForText: "", ...input });
    return result.success ? null : Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
  };

  it("reports a missing paid for together with other fields' errors", () => {
    expect(issues({ expenseType: "wages", amount: Number.NaN })).toEqual({ amount: expect.any(String), paidForText: expect.stringMatching(/e\.g\. Guide expense/) });
    const form = expenseFormSchema("20/10/2026").safeParse({ ...draft, expenseType: "salary", paidForId: "", amount: Number.NaN, expenseDate: "21/10/2026" });
    expect(form.success ? [] : form.error.issues.map((i) => i.path.join(".")).sort()).toEqual(["amount", "expenseDate", "paidForId"]);
  });

  it("needs an ID from a list for salary, package cost and marketing", () => {
    expect(issues({ expenseType: "salary" })).toEqual({ paidForId: "Choose the team member." });
    expect(issues({ expenseType: "package_cost", paidForId: "not-an-id" })).toEqual({ paidForId: "Choose the package." });
    expect(issues({ expenseType: "marketing", paidForId: PACKAGE_ID })).toBeNull();
  });

  it("needs a description for marketing Other, wages and miscellaneous", () => {
    expect(issues({ expenseType: "marketing", paidForId: "other" })).toEqual({ paidForText: expect.stringMatching(/Describe the marketing/) });
    expect(issues({ expenseType: "marketing", paidForId: "other", paidForText: "Flyers" })).toBeNull();
    expect(issues({ expenseType: "wages" })).toEqual({ paidForText: expect.stringMatching(/e\.g\. Guide expense/) });
    expect(issues({ expenseType: "miscellaneous", paidForText: "  Tea  " })).toBeNull();
    expect(issues({ expenseType: "wages", paidForText: "x".repeat(101) })).toEqual({ paidForText: expect.stringMatching(/at most 100/) });
  });

  it("lets a create leave out the field its type doesn't use, but an edit never blanks it", () => {
    const { paidForId: _id, ...withoutId } = draft;
    void _id;
    expect(expenseDraftSchema.parse({ ...withoutId, expenseType: "wages", paidForText: "Cook" })).toMatchObject({ paidForId: "", paidForText: "Cook" });
    expect(updateExpenseSchema.parse({ amount: 10 })).toEqual({ amount: 10 });
  });

  it("turns a saved paid-for back into the form's fields", () => {
    expect(paidForInput("salary", { refId: PACKAGE_ID, label: "Ravi" })).toEqual({ paidForId: PACKAGE_ID, paidForText: "" });
    expect(paidForInput("marketing", { refId: null, label: "Flyers" })).toEqual({ paidForId: "other", paidForText: "Flyers" });
    expect(paidForInput("wages", { refId: null, label: "Cook" })).toEqual({ paidForId: "", paidForText: "Cook" });
    expect(paidForInput("salary", null)).toEqual({ paidForId: "", paidForText: "" });
  });

  it("reads a saved paid-for, with Other marked on marketing", () => {
    expect(paidForLabel("salary", { refId: PACKAGE_ID, label: "Ravi" })).toBe("Ravi");
    expect(paidForLabel("marketing", { refId: PACKAGE_ID, label: "Meta Ads" })).toBe("Meta Ads");
    expect(paidForLabel("marketing", { refId: null, label: "Flyers" })).toBe("Other · Flyers");
    expect(paidForLabel("wages", { refId: null, label: "Cook" })).toBe("Cook");
    expect(paidForLabel("wages", null)).toBe("—");
  });

  it("previews what the form's paid-for fields will save", () => {
    const options = { team: [{ id: PACKAGE_ID, name: "Ravi", detail: "Guide" }], package: [], marketing: [] };
    expect(paidForPreview("salary", { paidForId: PACKAGE_ID, paidForText: "" }, options)).toEqual({ refId: PACKAGE_ID, label: "Ravi" });
    expect(paidForPreview("package_cost", { paidForId: PACKAGE_ID, paidForText: "" }, options)).toBeNull();
    expect(paidForPreview("marketing", { paidForId: "other", paidForText: " Flyers " }, options)).toEqual({ refId: null, label: "Flyers" });
    expect(paidForPreview("wages", { paidForId: "", paidForText: "  " }, options)).toBeNull();
  });
});

describe("expense filters", () => {
  it("keeps known values and drops the rest", () => {
    expect(parseExpenseFilters({ kind: "direct", type: "wages", archived: "1", page: "2" })).toEqual({
      kind: "direct",
      type: "wages",
      archived: true,
      from: "",
      to: "",
      page: 2,
    });
    expect(parseExpenseFilters({ kind: "other", type: "travel", page: "0" })).toEqual({
      kind: undefined,
      type: undefined,
      archived: false,
      from: "",
      to: "",
      page: 1,
    });
    expect(expenseFilterParams(parseExpenseFilters({ type: "salary" }))).toEqual({ kind: "", type: "salary", paidFor: "", archived: "", from: "", to: "" });
  });

  it("keeps a paid-for filter only with a type picked from a list", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    expect(parseExpenseFilters({ type: "salary", paidFor: id }).paidFor).toBe(id);
    expect(parseExpenseFilters({ type: "marketing", paidFor: "other" }).paidFor).toBe("other");
    expect(parseExpenseFilters({ type: "salary", paidFor: "other" }).paidFor).toBeUndefined();
    expect(parseExpenseFilters({ type: "wages", paidFor: id }).paidFor).toBeUndefined();
    expect(parseExpenseFilters({ paidFor: id }).paidFor).toBeUndefined();
    expect(parseExpenseFilters({ type: "salary", paidFor: "not-an-id" }).paidFor).toBeUndefined();
  });
});

describe("expenseStatusBadge", () => {
  it("reads Spent for an active expense, and Archived for an archived one", () => {
    expect(expenseStatusBadge("Active")).toBe("Spent");
    expect(expenseStatusBadge("Archived")).toBe("Archived");
  });
});
