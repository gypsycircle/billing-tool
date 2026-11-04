// lib/server/expenses/service.ts
// Expense data access. Pages and route handlers call these functions — never
// the repository directly. Every function verifies the session itself.
//
// Writes: validate (Zod) → business rules (version, archived, date not in
// the future, "paid for" from the right list) → one atomic database write.
// The server assigns the expense number (EXP_{year}{counter}, from a per-year
// counter), the kind (from the type) and the paid-for name (from the list);
// none is ever taken from the client. Every change carries the
// version (updatedAt) the user was looking at, so a stale screen can never
// overwrite a newer save.

import "server-only";

import { cache } from "react";
import { getYear } from "date-fns";
import { parseDDMMYYYY, todayIST } from "@/lib/domain/dates";
import { expenseDateIssue, expenseDraftSchema, expenseIdSchema, updateExpenseSchema } from "@/lib/domain/expense.schema";
import { restoreSchema } from "@/lib/domain/field-rules";
import type { ExpenseFilters } from "@/lib/domain/expense-filters";
import {
  EXPENSE_TYPE_IDS,
  expenseKindOf,
  FIRST_EXPENSE_NUMBER,
  formatExpenseNumber,
  MARKETING_OTHER,
  paidForInput,
  paidForListOf,
  paidForOf,
  type Expense,
  type ExpenseDraft,
  type ExpenseRef,
  type ExpenseType,
  type PaidFor,
  type PaidForOptions,
} from "@/lib/domain/expenses";
import { nextSequence } from "@/lib/domain/invoice-number";
import { isArchived } from "@/lib/domain/records";
import { issueSequence, peekSequence } from "../db/counters-repo";
import {
  expenseLedgerPage,
  findExpense,
  findExpenseByIdempotencyKey,
  findExpenseVersion,
  insertExpense,
  setExpenseStatusIfVersion,
  updateExpenseIfVersion,
  type ExpenseLedgerResult,
} from "../db/expenses-repo";
import { generalRepo } from "../db/general-repo";
import { teamRepo } from "../db/team-repo";
import { getTeamFilterOptions, getTeamOptions } from "../team/service";
import { getGeneralOptions } from "../general/service";
import { ArchivedRecordError, NotFoundError, ValidationError } from "../errors";
import { verifySession } from "../guards";
import { assertCurrentVersion, assertRecordId, assertVersionFor, nextTimestamp, notWritten, onePerKey, statusOrEdit, validate } from "../records/rules";

const assertExpenseId = (id: string) => assertRecordId("expense", expenseIdSchema, id);

/** Expense numbers count up per calendar year (IST) of the day they are recorded. */
const currentYear = () => getYear(parseDDMMYYYY(todayIST())!);

/** An expense can't be dated after today. */
function assertDateAllowed(expenseDate: string): void {
  const message = expenseDateIssue(expenseDate, todayIST());
  if (message) throw new ValidationError({ expenseDate: message });
}

/**
 * Where the money went, as stored: typed text as it is, or the team member,
 * package or channel picked, which must be active in the right list. Its name
 * is kept as it is now. An unchanged choice on an edit stays as saved, even
 * if it was archived or renamed since.
 */
async function resolvePaidFor({ expenseType, paidForId, paidForText }: ExpenseDraft, saved: Expense | null): Promise<PaidFor> {
  const { source, missing } = paidForOf(expenseType);
  if (source === "text" || (source === "marketing" && paidForId === MARKETING_OTHER)) return { refId: null, label: paidForText };
  if (saved?.expenseType === expenseType && saved.paidFor?.refId === paidForId) return saved.paidFor;

  const picked = source === "team" ? await teamRepo.find(paidForId) : await generalRepo.find(paidForId, { kind: source });
  if (!picked || picked.status !== "Active") throw new ValidationError({ paidForId: missing.replace(/\.$/, " from the list.") });
  return { refId: picked.id, label: picked.name };
}

/** The expense to store from what the user entered (the form's paid-for fields become `paidFor`). */
const fieldsOf = ({ paidForId, paidForText, ...fields }: ExpenseDraft) => {
  void paidForId; void paidForText;
  return fields;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The expenses page: one page of rows for the filters, their count and total, and the two tiles. */
export async function getExpenseLedger(filters: ExpenseFilters): Promise<ExpenseLedgerResult> {
  await verifySession();
  return expenseLedgerPage(filters);
}

/** One expense by its UUID. Throws NotFoundError. Cached per render. */
export const getExpense = cache(async (id: string): Promise<Expense> => {
  await verifySession();
  assertExpenseId(id);
  const expense = await findExpense(id);
  if (!expense) throw new NotFoundError("expense");
  return expense;
});

/** The number an expense saved now would most likely get (shown on the form; assigned on save). */
export async function suggestExpenseNumber(): Promise<string> {
  await verifySession();
  const year = currentYear();
  return formatExpenseNumber(year, nextSequence(await peekSequence("expense", year), FIRST_EXPENSE_NUMBER));
}

/**
 * The form's paid-for dropdowns: active team members, packages and marketing
 * channels, by name. On an edit, the saved choice is offered too when it has
 * been archived since (it saves unchanged), marked as archived.
 */
export async function getPaidForOptions(expense?: Expense): Promise<PaidForOptions> {
  await verifySession();
  const [team, pkg, marketing] = await Promise.all([getTeamOptions(), getGeneralOptions("package"), getGeneralOptions("marketing")]);
  const options: PaidForOptions = { team, package: pkg, marketing };
  const source = expense && paidForOf(expense.expenseType).source;
  const saved = expense?.paidFor;
  if (source && source !== "text" && saved?.refId && !options[source].some((o) => o.id === saved.refId)) {
    options[source] = [...options[source], { id: saved.refId, name: saved.label, detail: "Archived" }];
  }
  return options;
}

/**
 * The list's paid-for filter for a type (value → label): its whole list,
 * active first, then archived ones (marked), so older expenses can still be
 * found; marketing adds Other. Empty for a type whose paid for is typed.
 */
export async function getPaidForFilterOptions(type: ExpenseType): Promise<Record<string, string>> {
  await verifySession();
  const list = paidForListOf(type);
  if (!list) return {};
  if (list === "team") return getTeamFilterOptions();
  const records = await generalRepo.list({ kind: list });
  const options: Record<string, string> = Object.fromEntries(records.map((r) => [r.id, isArchived(r) ? `${r.name} · Archived` : r.name]));
  if (list === "marketing") options[MARKETING_OTHER] = "Other";
  return options;
}

/** Those choices for every type with a list: the filter offers them before a picked type is applied. */
export async function getPaidForFilterChoices(): Promise<Partial<Record<ExpenseType, Record<string, string>>>> {
  const types = EXPENSE_TYPE_IDS.filter((type) => paidForListOf(type) !== null);
  const choices = await Promise.all(types.map(getPaidForFilterOptions));
  return Object.fromEntries(types.map((type, i) => [type, choices[i]]));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const oneCreatePerKey = onePerKey<Expense>();

/**
 * Creates an expense with the next number and its type's kind. Repeats with
 * the same idempotency key return the first expense instead of another.
 */
export async function createExpense(input: unknown, idempotencyKey?: string): Promise<Expense> {
  await verifySession();
  return oneCreatePerKey(idempotencyKey, () => createNewExpense(input, idempotencyKey));
}

async function createNewExpense(input: unknown, idempotencyKey?: string): Promise<Expense> {
  // The note is optional: a create without it means "no note"
  const draft = validate(
    expenseDraftSchema,
    input && typeof input === "object" && !("note" in input) ? { ...input, note: "" } : input
  );
  assertDateAllowed(draft.expenseDate);

  const earlier = idempotencyKey ? await findExpenseByIdempotencyKey(idempotencyKey) : null;
  if (earlier) return earlier;
  const paidFor = await resolvePaidFor(draft, null);

  // Everything is checked before a number is taken, so a refused expense never uses one up
  const year = currentYear();
  const sequence = await issueSequence("expense", year, FIRST_EXPENSE_NUMBER);
  const now = new Date().toISOString();
  const expense: Expense = {
    ...fieldsOf(draft),
    paidFor,
    expenseId: crypto.randomUUID(),
    expenseNumber: formatExpenseNumber(year, sequence),
    expenseKind: expenseKindOf(draft.expenseType),
    status: "Active",
    createdAt: now,
    updatedAt: now,
  };
  return insertExpense(expense, idempotencyKey);
}

/**
 * Updates an expense. The change is merged onto the stored expense and the
 * whole result is re-validated; a new type brings its kind with it, and
 * needs its own "paid for" (an expense saved before "paid for" existed gets
 * one on its next edit).
 * `expectedUpdatedAt` is the version the user edited (X-Record-Version).
 */
export async function updateExpense(id: string, input: unknown, expectedUpdatedAt: string): Promise<Expense> {
  await verifySession();
  assertExpenseId(id);
  const changes = validate(updateExpenseSchema, input);

  const expense = await findExpense(id);
  if (!expense) throw new NotFoundError("expense"); // before the version: an unknown expense is 404, not 428
  assertCurrentVersion("expense", expense.updatedAt, expectedUpdatedAt);
  if (isArchived(expense)) throw new ArchivedRecordError("expense");
  // A changed date can't be in the future; an unchanged one stays as it is
  if (changes.expenseDate !== undefined && changes.expenseDate !== expense.expenseDate) assertDateAllowed(changes.expenseDate);

  // A new type's "paid for" comes from this edit, never from the old type's
  const typeChanged = changes.expenseType !== undefined && changes.expenseType !== expense.expenseType;
  const current: ExpenseDraft = {
    expenseType: expense.expenseType,
    amount: expense.amount,
    expenseDate: expense.expenseDate,
    note: expense.note,
    ...(typeChanged ? { paidForId: "", paidForText: "" } : paidForInput(expense.expenseType, expense.paidFor)),
  };
  const data = validate(expenseDraftSchema, { ...current, ...changes });
  const paidFor = await resolvePaidFor(data, expense);
  const updated: Expense = {
    ...expense,
    ...fieldsOf(data),
    paidFor,
    expenseKind: expenseKindOf(data.expenseType),
    updatedAt: nextTimestamp(expense.updatedAt),
  };

  if (await updateExpenseIfVersion(updated, expectedUpdatedAt)) return updated;
  return notWritten("expense", () => findExpenseVersion(id));
}

/** Archives (soft delete) or restores an expense, if it is still at the version on screen. */
export async function setExpenseStatus(id: string, status: Expense["status"], expectedUpdatedAt: string): Promise<ExpenseRef> {
  await verifySession();
  assertExpenseId(id);
  await assertVersionFor("expense", expectedUpdatedAt, () => findExpenseVersion(id));
  return (
    (await setExpenseStatusIfVersion(id, expectedUpdatedAt, status, nextTimestamp(expectedUpdatedAt))) ??
    notWritten("expense", () => findExpenseVersion(id))
  );
}

/** Soft-deletes an expense. It stays in the database and can be restored. */
export function archiveExpense(id: string, expectedUpdatedAt: string): Promise<ExpenseRef> {
  return setExpenseStatus(id, "Archived", expectedUpdatedAt);
}

/** A PATCH: { status: "Active" } on its own restores; anything else is an edit. */
export function changeExpense(id: string, input: unknown, expectedUpdatedAt: string): Promise<ExpenseRef> {
  return statusOrEdit(input, restoreSchema, {
    status: ({ status }) => setExpenseStatus(id, status, expectedUpdatedAt),
    edit: (changes) => updateExpense(id, changes, expectedUpdatedAt),
  });
}
