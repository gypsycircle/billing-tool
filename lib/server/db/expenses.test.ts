// Expenses against a real (in-memory) MongoDB: the list's filters, tiles and
// pages, numbering, the kind always following the type, versioned edits,
// archive and restore, idempotent creates, and the indexes behind the list.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "mongodb";
import { addDays, toISODate, todayIST } from "@/lib/domain/dates";
import { parseExpenseFilters } from "@/lib/domain/expense-filters";
import { EXPENSE_ROW_FIELDS, type ExpenseDraft } from "@/lib/domain/expenses";
import { PAGE_SIZE } from "@/lib/domain/filters";
import { setUpTestDatabase, stagesOf } from "./test-database";
import { LIST_IDS, paidForFields, seedLists } from "./test-fixtures";

vi.mock("../guards", () => ({ verifySession: async () => {}, requireSessionOrRedirect: async () => {} }));

const { clear } = setUpTestDatabase("expenses_test");
beforeEach(clear);
beforeEach(seedLists);

const today = todayIST();
const year = today.slice(6);
const draft = (overrides: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  expenseType: "package_cost",
  amount: 25_000,
  expenseDate: addDays(today, -3),
  note: "Camp at Juda ka Talab",
  ...paidForFields(overrides.expenseType ?? "package_cost"),
  ...overrides,
});

const service = () => import("../expenses/service");

describe("creating expenses", () => {
  it("numbers them EXP_{year}0001, 0002… and sets the kind from the type", async () => {
    const { createExpense } = await service();
    const a = await createExpense(draft());
    const b = await createExpense(draft({ expenseType: "salary", amount: 40_000 }));
    expect([a.expenseNumber, b.expenseNumber]).toEqual([`EXP_${year}0001`, `EXP_${year}0002`]);
    expect([a.expenseKind, b.expenseKind]).toEqual(["direct", "indirect"]);
    expect(a.status).toBe("Active");
  });

  it("ignores a kind, number or status sent by the client", async () => {
    const { createExpense } = await service();
    const a = await createExpense({ ...draft({ expenseType: "marketing" }), expenseKind: "direct", expenseNumber: "EXP_1", status: "Archived" });
    expect([a.expenseKind, a.expenseNumber, a.status]).toEqual(["indirect", `EXP_${year}0001`, "Active"]);
  });

  it("accepts a missing note, refuses a future date, and refused ones use no number", async () => {
    const { createExpense } = await service();
    const { ValidationError } = await import("../errors");
    const { note: _note, ...withoutNote } = draft();
    void _note;
    expect((await createExpense(withoutNote)).note).toBe("");
    await expect(createExpense(draft({ expenseDate: addDays(today, 1) }))).rejects.toBeInstanceOf(ValidationError);
    await expect(createExpense(draft({ amount: 0 }))).rejects.toBeInstanceOf(ValidationError);
    expect((await createExpense(draft())).expenseNumber).toBe(`EXP_${year}0002`);
  });

  it("returns the first expense for a repeated idempotency key, storing it once", async () => {
    const { createExpense } = await service();
    const { expensesCollection } = await import("./collections");
    const key = "expense-key-1234567890";
    const [first, again] = await Promise.all([createExpense(draft(), key), createExpense(draft(), key)]);
    expect(again.expenseId).toBe(first.expenseId);
    expect(await (await expensesCollection()).countDocuments()).toBe(1);
    expect((await createExpense(draft())).expenseNumber).toBe(`EXP_${year}0002`);
  });
});

describe("changing expenses", () => {
  it("edits fields, moves the kind with the type, and advances the version", async () => {
    const { createExpense, getExpense, updateExpense } = await service();
    const a = await createExpense(draft());
    const edited = await updateExpense(a.expenseId, { expenseType: "marketing", amount: 9_000, paidForId: LIST_IDS.marketing }, a.updatedAt);
    expect([edited.expenseKind, edited.amount, edited.note, edited.paidFor]).toEqual(["indirect", 9_000, a.note, { refId: LIST_IDS.marketing, label: "Meta Ads" }]);
    expect(edited.updatedAt > a.updatedAt).toBe(true);
    expect(await getExpense(a.expenseId)).toEqual(edited);
  });

  it("refuses a kind, number or status in an edit, and a new future date (but keeps an old date)", async () => {
    const { createExpense, updateExpense } = await service();
    const { ValidationError } = await import("../errors");
    const a = await createExpense(draft());
    for (const change of [{ expenseKind: "indirect" }, { expenseNumber: "EXP_9" }, { status: "Archived" }, {}]) {
      await expect(updateExpense(a.expenseId, change, a.updatedAt)).rejects.toBeInstanceOf(ValidationError);
    }
    await expect(updateExpense(a.expenseId, { expenseDate: addDays(today, 2) }, a.updatedAt)).rejects.toBeInstanceOf(ValidationError);
    expect((await updateExpense(a.expenseId, { expenseDate: a.expenseDate, amount: 1 }, a.updatedAt)).amount).toBe(1);
  });

  it("answers 404 for an unknown expense before 428 for a missing version, and 412 for a stale one", async () => {
    const { archiveExpense, createExpense, updateExpense } = await service();
    const { MissingVersionError, NotFoundError, StaleRecordError } = await import("../errors");
    const unknown = crypto.randomUUID();
    await expect(updateExpense(unknown, { amount: 1 }, "")).rejects.toBeInstanceOf(NotFoundError);
    await expect(archiveExpense(unknown, "")).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateExpense("not-a-uuid", { amount: 1 }, "x")).rejects.toBeInstanceOf(NotFoundError);
    const a = await createExpense(draft());
    await expect(updateExpense(a.expenseId, { amount: 1 }, "")).rejects.toBeInstanceOf(MissingVersionError);
    await updateExpense(a.expenseId, { amount: 2 }, a.updatedAt);
    await expect(updateExpense(a.expenseId, { amount: 3 }, a.updatedAt)).rejects.toBeInstanceOf(StaleRecordError);
    await expect(archiveExpense(a.expenseId, a.updatedAt)).rejects.toBeInstanceOf(StaleRecordError);
  });

  it("only lets one of two simultaneous edits of the same version through", async () => {
    const { createExpense, updateExpense } = await service();
    const a = await createExpense(draft());
    const results = await Promise.allSettled([
      updateExpense(a.expenseId, { note: "First" }, a.updatedAt),
      updateExpense(a.expenseId, { note: "Second" }, a.updatedAt),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("archives, refuses edits while archived, and restores", async () => {
    const { archiveExpense, createExpense, setExpenseStatus, updateExpense } = await service();
    const { ArchivedRecordError } = await import("../errors");
    const a = await createExpense(draft());
    const archived = await archiveExpense(a.expenseId, a.updatedAt);
    expect(archived.status).toBe("Archived");
    await expect(updateExpense(a.expenseId, { amount: 1 }, archived.updatedAt)).rejects.toBeInstanceOf(ArchivedRecordError);
    const restored = await setExpenseStatus(a.expenseId, "Active", archived.updatedAt);
    expect(restored).toMatchObject({ status: "Active", expenseNumber: a.expenseNumber });
  });

  it("takes a PATCH as a restore when it is { status: \"Active\" } alone, else as an edit", async () => {
    const { archiveExpense, changeExpense, createExpense } = await service();
    const a = await createExpense(draft());
    const archived = await archiveExpense(a.expenseId, a.updatedAt);
    const restored = await changeExpense(a.expenseId, { status: "Active" }, archived.updatedAt);
    expect(restored.status).toBe("Active");
    const edited = await changeExpense(a.expenseId, { amount: 7_000 }, restored.updatedAt);
    expect(edited).toMatchObject({ amount: 7_000, status: "Active" });
    await expect(changeExpense(a.expenseId, { status: "Active", amount: 1 }, edited.updatedAt)).rejects.toMatchObject({ name: "ValidationError" });
  });
});

describe("the expenses list", () => {
  async function seed() {
    const { archiveExpense, createExpense } = await service();
    await createExpense(draft({ expenseType: "package_cost", amount: 30_000, expenseDate: addDays(today, -5) }));
    await createExpense(draft({ expenseType: "wages", amount: 6_000, expenseDate: addDays(today, -1) }));
    await createExpense(draft({ expenseType: "salary", amount: 40_000, expenseDate: addDays(today, -10) }));
    await createExpense(draft({ expenseType: "marketing", amount: 4_000, expenseDate: today }));
    const gone = await createExpense(draft({ expenseType: "wages", amount: 999, expenseDate: today }));
    await archiveExpense(gone.expenseId, gone.updatedAt);
  }
  const list = async (params: Record<string, string> = {}) => (await service()).getExpenseLedger(parseExpenseFilters(params));
  const types = async (params: Record<string, string> = {}) => (await list(params)).items.map((e) => `${e.expenseType}:${e.amount}`);

  it("lists active expenses, newest expense date first, with only the columns shown", async () => {
    await seed();
    const result = await list();
    expect(result.items.map((e) => e.expenseType)).toEqual(["marketing", "wages", "package_cost", "salary"]);
    expect(Object.keys(result.items[0]).sort()).toEqual([...EXPENSE_ROW_FIELDS].sort());
    expect(result.totals).toEqual({ count: 4, total: 80_000 });
  });

  it("filters by kind, type, and the archived view", async () => {
    await seed();
    expect(await types({ kind: "direct" })).toEqual(["wages:6000", "package_cost:30000"]);
    expect(await types({ type: "salary" })).toEqual(["salary:40000"]);
    expect(await types({ kind: "direct", type: "salary" })).toEqual([]);
    expect(await types({ archived: "1" })).toEqual(["wages:999"]);
    expect((await list({ kind: "indirect" })).totals).toEqual({ count: 2, total: 44_000 });
  });

  it("filters by expense date: a range, an open end, both ends included; a reversed range is ignored", async () => {
    await seed();
    const iso = (days: number) => toISODate(addDays(today, days));
    // Seeded: marketing today, wages 1 day ago, package cost 5, salary 10
    expect(await types({ from: iso(-5), to: iso(-1) })).toEqual(["wages:6000", "package_cost:30000"]);
    expect(await types({ from: iso(0) })).toEqual(["marketing:4000"]);
    expect(await types({ to: iso(-6) })).toEqual(["salary:40000"]);
    expect(await types({ type: "wages", from: iso(-1), to: iso(-1) })).toEqual(["wages:6000"]);
    expect(await types({ from: iso(-1), to: iso(-5) })).toEqual(["marketing:4000", "wages:6000", "package_cost:30000", "salary:40000"]);
    expect((await list({ from: iso(-5), to: iso(-1) })).totals).toEqual({ count: 2, total: 36_000 });
  });

  it("totals the tiles per kind over active expenses, whatever the filters", async () => {
    await seed();
    const expected = { direct: { total: 36_000, count: 2 }, indirect: { total: 44_000, count: 2 } };
    expect((await list()).kinds).toEqual(expected);
    expect((await list({ type: "salary", archived: "1" })).kinds).toEqual(expected);
  });

  it("tells no matches from no expenses at all", async () => {
    const empty = await list();
    expect([empty.empty, empty.total, empty.kinds.direct.total]).toEqual([true, 0, 0]);
    await seed();
    const none = await list({ kind: "direct", type: "salary" });
    expect([none.empty, none.total]).toEqual([false, 0]);
  });

  it("cuts pages of PAGE_SIZE and clamps a page past the end", async () => {
    const { createExpense } = await service();
    for (let i = 0; i < PAGE_SIZE + 3; i++) await createExpense(draft({ amount: 100 + i, expenseDate: addDays(today, -i) }));
    const second = await list({ page: "2" });
    expect([second.page, second.pageCount, second.from, second.to, second.total]).toEqual([2, 2, PAGE_SIZE + 1, PAGE_SIZE + 3, PAGE_SIZE + 3]);
    expect((await list({ page: "9" })).page).toBe(2);
  });

  it.each([
    ["the default view", {}],
    ["the archived view", { archived: "1" }],
    ["a kind", { kind: "direct" }],
    ["a type", { type: "wages" }],
    ["a team member", { type: "salary", paidFor: LIST_IDS.member }],
    ["marketing's Other", { type: "marketing", paidFor: "other" }],
    ["a date range", { from: "2026-01-01", to: "2026-12-31" }],
    ["a type and a date range", { type: "wages", from: "2026-01-01" }],
  ])("reads %s straight off an index, with no in-memory sort", async (_label, params) => {
    await seed();
    const { expensesCollection } = await import("./collections");
    const { expenseMatch, NEWEST_EXPENSE_FIRST } = await import("./expense-query");
    const plan = await (await expensesCollection())
      .find(expenseMatch(parseExpenseFilters(params)))
      .sort(NEWEST_EXPENSE_FIRST)
      .limit(PAGE_SIZE)
      .explain("queryPlanner");
    const stages = stagesOf((plan as Document).queryPlanner.winningPlan);
    expect(stages).toContain("IXSCAN");
    expect(stages).not.toContain("SORT");
    expect(stages).not.toContain("COLLSCAN");
  });
});

describe("the expenses collection", () => {
  it("refuses a kind that doesn't match a valid one, or a zero amount, at the database too", async () => {
    const { expensesCollection } = await import("./collections");
    const base = {
      _id: crypto.randomUUID(), expenseNumber: "EXP_X", expenseYear: 2026, expenseType: "wages", expenseKind: "direct",
      amount: 10, expenseDate: new Date(), note: "", status: "Active", createdAt: new Date(), updatedAt: new Date(),
    };
    const collection = await expensesCollection();
    await expect(collection.insertOne({ ...base, expenseKind: "other" } as never)).rejects.toThrow(/validation/i);
    await expect(collection.insertOne({ ...base, amount: 0 } as never)).rejects.toThrow(/validation/i);
  });
});

describe("where the money went (paid for)", () => {
  const paidFor = async (overrides: Partial<ExpenseDraft>) => (await (await service()).createExpense(draft(overrides))).paidFor;

  it("stores the picked team member, package or channel by name, or the typed text", async () => {
    expect(await paidFor({ expenseType: "salary" })).toEqual({ refId: LIST_IDS.member, label: "Ravi Kumar" });
    expect(await paidFor({ expenseType: "package_cost" })).toEqual({ refId: LIST_IDS.package, label: "Delhi - Agra Package" });
    expect(await paidFor({ expenseType: "marketing" })).toEqual({ refId: LIST_IDS.marketing, label: "Meta Ads" });
    expect(await paidFor({ expenseType: "marketing", paidForId: "other", paidForText: "Flyers at college fest" })).toEqual({ refId: null, label: "Flyers at college fest" });
    expect(await paidFor({ expenseType: "wages", paidForText: " Guide expense " })).toEqual({ refId: null, label: "Guide expense" });
    expect(await paidFor({ expenseType: "miscellaneous", paidForText: "Office tea" })).toEqual({ refId: null, label: "Office tea" });
  });

  it("asks for the right thing per type", async () => {
    const { createExpense } = await service();
    const fieldErrors = (overrides: Partial<ExpenseDraft>) => createExpense(draft({ paidForId: "", paidForText: "", ...overrides })).then(() => null, (err) => err.fieldErrors);
    expect(await fieldErrors({ expenseType: "salary" })).toEqual({ paidForId: "Choose the team member." });
    expect(await fieldErrors({ expenseType: "package_cost" })).toEqual({ paidForId: "Choose the package." });
    expect(await fieldErrors({ expenseType: "marketing" })).toEqual({ paidForId: "Choose the channel." });
    expect(await fieldErrors({ expenseType: "marketing", paidForId: "other" })).toEqual({ paidForText: expect.stringMatching(/Describe the marketing/) });
    expect(await fieldErrors({ expenseType: "wages" })).toEqual({ paidForText: expect.stringMatching(/Guide expense/) });
    expect(await fieldErrors({ expenseType: "wages", paidForText: "=SUM(A1)" })).toEqual({ paidForText: expect.stringMatching(/can't start with/) });
  });

  it("refuses an ID from the wrong list, an unknown one, or an archived one; refused ones use no number", async () => {
    const { createExpense } = await service();
    const { usersCollection } = await import("./collections");
    const refused = (overrides: Partial<ExpenseDraft>) => createExpense(draft(overrides)).then(() => null, (err) => err.fieldErrors?.paidForId);
    expect(await refused({ expenseType: "salary", paidForId: LIST_IDS.package })).toBe("Choose the team member from the list.");
    expect(await refused({ expenseType: "package_cost", paidForId: LIST_IDS.marketing })).toBe("Choose the package from the list.");
    expect(await refused({ expenseType: "marketing", paidForId: crypto.randomUUID() })).toBe("Choose the channel from the list.");
    await (await usersCollection()).updateOne({ _id: LIST_IDS.member }, { $set: { status: "Archived" } });
    expect(await refused({ expenseType: "salary" })).toBe("Choose the team member from the list.");
    expect((await createExpense(draft())).expenseNumber).toBe(`EXP_${year}0001`);
  });

  it("keeps an unchanged choice through renames and archiving, and needs a new one when the type changes", async () => {
    const { createExpense, updateExpense } = await service();
    const { usersCollection } = await import("./collections");
    const a = await createExpense(draft({ expenseType: "salary" }));
    await (await usersCollection()).updateOne({ _id: LIST_IDS.member }, { $set: { name: "Ravi K", nameKey: "ravi k", status: "Archived" } });
    const b = await updateExpense(a.expenseId, { amount: 41_000 }, a.updatedAt);
    expect(b.paidFor).toEqual({ refId: LIST_IDS.member, label: "Ravi Kumar" });
    await expect(updateExpense(a.expenseId, { expenseType: "wages" }, b.updatedAt)).rejects.toMatchObject({ fieldErrors: { paidForText: expect.any(String) } });
    const c = await updateExpense(a.expenseId, { expenseType: "wages", paidForText: "Driver bata" }, b.updatedAt);
    expect([c.expenseKind, c.paidFor]).toEqual(["direct", { refId: null, label: "Driver bata" }]);
  });

  it("asks an expense saved before paid-for existed for one on its next edit", async () => {
    const { createExpense, getExpense, updateExpense } = await service();
    const { expensesCollection } = await import("./collections");
    const a = await createExpense(draft({ expenseType: "wages" }));
    await (await expensesCollection()).updateOne({ _id: a.expenseId }, { $unset: { paidFor: "" } });
    const old = await getExpense(a.expenseId);
    expect(old.paidFor).toBeNull();
    await expect(updateExpense(a.expenseId, { amount: 7_000 }, old.updatedAt)).rejects.toMatchObject({ fieldErrors: { paidForText: expect.any(String) } });
    expect((await updateExpense(a.expenseId, { amount: 7_000, paidForText: "Cook" }, old.updatedAt)).paidFor).toEqual({ refId: null, label: "Cook" });
  });

  it("offers the form's dropdowns, plus an edited expense's saved choice once it is archived", async () => {
    const { createExpense, getPaidForOptions } = await service();
    const { usersCollection } = await import("./collections");
    expect(await getPaidForOptions()).toEqual({
      team: [{ id: LIST_IDS.member, name: "Ravi Kumar", detail: "Guide" }],
      package: [{ id: LIST_IDS.package, name: "Delhi - Agra Package" }],
      marketing: [{ id: LIST_IDS.marketing, name: "Meta Ads" }],
    });
    const salary = await createExpense(draft({ expenseType: "salary" }));
    const wages = await createExpense(draft({ expenseType: "wages" }));
    expect((await getPaidForOptions(salary)).team).toHaveLength(1);
    await (await usersCollection()).updateOne({ _id: LIST_IDS.member }, { $set: { status: "Archived" } });
    expect((await getPaidForOptions()).team).toEqual([]);
    expect((await getPaidForOptions(salary)).team).toEqual([{ id: LIST_IDS.member, name: "Ravi Kumar", detail: "Archived" }]);
    expect((await getPaidForOptions(wages)).team).toEqual([]);
  });

  it("filters by who or what was paid, archived ones and marketing's Other included", async () => {
    const { createExpense, getExpenseLedger, getPaidForFilterOptions } = await service();
    const { usersCollection } = await import("./collections");
    await createExpense(draft({ expenseType: "salary", amount: 1_000 }));
    await createExpense(draft({ expenseType: "marketing", amount: 2_000 }));
    await createExpense(draft({ expenseType: "marketing", amount: 3_000, paidForId: "other", paidForText: "Flyers" }));
    await (await usersCollection()).updateOne({ _id: LIST_IDS.member }, { $set: { status: "Archived" } });
    const amounts = async (params: Record<string, string>) => (await getExpenseLedger(parseExpenseFilters(params))).items.map((e) => e.amount);
    expect(await amounts({ type: "salary", paidFor: LIST_IDS.member })).toEqual([1_000]);
    expect(await amounts({ type: "marketing", paidFor: LIST_IDS.marketing })).toEqual([2_000]);
    expect(await amounts({ type: "marketing", paidFor: "other" })).toEqual([3_000]);
    expect(await amounts({ type: "salary", paidFor: crypto.randomUUID() })).toEqual([]);
    expect(await getPaidForFilterOptions("salary")).toEqual({ [LIST_IDS.member]: "Ravi Kumar · Archived" });
    expect(await getPaidForFilterOptions("marketing")).toEqual({ [LIST_IDS.marketing]: "Meta Ads", other: "Other" });
    expect(await getPaidForFilterOptions("wages")).toEqual({});
  });

  it("lists each row's paid for", async () => {
    await (await service()).createExpense(draft({ expenseType: "salary" }));
    const { expenseLedgerPage } = await import("./expenses-repo");
    const { parseExpenseFilters } = await import("@/lib/domain/expense-filters");
    expect((await expenseLedgerPage(parseExpenseFilters({}))).items[0].paidFor).toEqual({ refId: LIST_IDS.member, label: "Ravi Kumar" });
  });
});
