// lib/server/db/expenses-repo.ts
// Persistence only: read and write expenses. No business rules (those live in
// lib/server/expenses/service.ts); expense numbers come from counters-repo.ts.
// Each function is one database round trip unless noted, and every read
// fetches only the fields its caller uses.

import "server-only";

import type { Filter } from "mongodb";
import type { ExpenseFilters } from "@/lib/domain/expense-filters";
import { EXPENSE_ROW_FIELDS, type Expense, type ExpenseKind, type ExpenseRef, type ExpenseRow } from "@/lib/domain/expenses";
import { PAGE_SIZE, type PageInfo } from "@/lib/domain/filters";
import { DuplicateNumberError } from "../errors";
import { isDuplicateKey } from "./duplicate-key";
import { expensesCollection, type ExpenseDoc } from "./collections";
import { expenseKindsGroup, expenseMatch, expenseTotalsGroup, NEWEST_EXPENSE_FIRST } from "./expense-query";
import { EXPENSE_PROJECTION, expenseReads, expenseUpdateSet, fromExpenseDoc, toExpenseDoc } from "./mapping";
import { clampPage, requestedPage, stripId } from "./paging";

// ── Reads ─────────────────────────────────────────────────────────────────

export async function findExpense(id: string): Promise<Expense | null> {
  const doc = await (await expensesCollection()).findOne({ _id: id }, { projection: EXPENSE_PROJECTION });
  return doc ? fromExpenseDoc(doc) : null;
}

/** The expense's current version (updatedAt), or null if there is no such expense. */
export async function findExpenseVersion(id: string): Promise<string | null> {
  const doc = await (await expensesCollection()).findOne({ _id: id }, { projection: { _id: 0, updatedAt: 1 } });
  return doc ? doc.updatedAt.toISOString() : null;
}

/** A tile: the total and number of active expenses of one kind. */
export interface KindTotal {
  total: number;
  count: number;
}

export interface ExpenseLedgerResult extends PageInfo {
  items: ExpenseRow[];
  /** Every expense matching the filters, across all pages. */
  totals: { count: number; total: number };
  /** The tiles: active expenses per kind, whatever the filters. */
  kinds: Record<ExpenseKind, KindTotal>;
  /** True when there are no expenses at all (not "no matches"). */
  empty: boolean;
}

const ROW_PROJECTION = expenseReads.projectionOf(EXPENSE_ROW_FIELDS);
const NO_KIND: KindTotal = { total: 0, count: 0 };

type Grouped<T> = T & { _id: null };

async function pageItems(match: Filter<ExpenseDoc>, skip: number, limit: number): Promise<ExpenseRow[]> {
  const docs = await (await expensesCollection())
    .find(match, { projection: ROW_PROJECTION })
    .sort(NEWEST_EXPENSE_FIRST)
    .skip(skip)
    .limit(limit)
    .toArray();
  return docs.map((doc) => expenseReads.pickFromDoc(doc, EXPENSE_ROW_FIELDS));
}

/**
 * The expenses page, as four small index-backed queries run in PARALLEL: the
 * page of rows, the count and total of all matches, the two tiles, and
 * whether any expense exists. A page past the end costs one more query.
 */
export async function expenseLedgerPage(filters: ExpenseFilters, pageSize = PAGE_SIZE): Promise<ExpenseLedgerResult> {
  const collection = await expensesCollection();
  const match = expenseMatch(filters);
  const page = requestedPage(filters.page);
  const fetchPage = (p: number) => pageItems(match, (p - 1) * pageSize, pageSize);

  const [firstItems, matching, kinds, any] = await Promise.all([
    fetchPage(page),
    collection.aggregate<Grouped<{ count: number; total: number }>>([{ $match: match }, ...expenseTotalsGroup]).toArray(),
    collection.aggregate<{ _id: ExpenseKind; total: number; count: number }>(expenseKindsGroup).toArray(),
    collection.findOne({}, { projection: { _id: 1 } }),
  ]);

  const totals = { count: 0, total: 0, ...stripId(matching[0]) };
  const byKind = Object.fromEntries(kinds.map(({ _id, total, count }) => [_id, { total, count }]));
  return {
    ...(await clampPage(page, pageSize, firstItems, totals.count, fetchPage)),
    totals,
    kinds: { direct: byKind.direct ?? NO_KIND, indirect: byKind.indirect ?? NO_KIND },
    empty: any === null,
  };
}

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Inserts a new expense. With an idempotency key, a repeat of the same create
 * (double submit, retry) returns the expense the first request stored.
 */
export async function insertExpense(expense: Expense, idempotencyKey?: string): Promise<Expense> {
  try {
    await (await expensesCollection()).insertOne(toExpenseDoc(expense, idempotencyKey));
    return expense;
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    if (idempotencyKey && err.keyPattern?.idempotencyKey) {
      const first = await findExpenseByIdempotencyKey(idempotencyKey);
      if (first) return first;
    }
    if (err.keyPattern?.expenseNumber) throw new DuplicateNumberError("expense", "Expense number", expense.expenseNumber);
    throw err;
  }
}

/** The expense a previous create with this key stored, if any. */
export async function findExpenseByIdempotencyKey(idempotencyKey: string): Promise<Expense | null> {
  const doc = await (await expensesCollection()).findOne({ idempotencyKey }, { projection: EXPENSE_PROJECTION });
  return doc ? fromExpenseDoc(doc) : null;
}

/**
 * Replaces an expense's editable fields only if it is still at the version the
 * caller read (`updatedAt`). False when it is missing or someone saved first —
 * the caller tells which. Nothing is read back.
 */
export async function updateExpenseIfVersion(expense: Expense, expectedUpdatedAt: string): Promise<boolean> {
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) return false;
  const result = await (await expensesCollection()).updateOne(
    { _id: expense.expenseId, updatedAt: expected, status: "Active" },
    { $set: expenseUpdateSet(expense) }
  );
  return result.matchedCount === 1;
}

const REF_FIELDS = ["expenseId", "expenseNumber", "updatedAt", "status"] as const;
const REF_PROJECTION = expenseReads.projectionOf(REF_FIELDS);

/**
 * Sets only the status (archive / restore), in one atomic call, if the expense
 * is still at `expectedUpdatedAt`. Returns its new reference, or null when
 * nothing matched — the caller tells why.
 */
export async function setExpenseStatusIfVersion(
  id: string,
  expectedUpdatedAt: string,
  status: Expense["status"],
  updatedAt: string
): Promise<ExpenseRef | null> {
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) return null;
  const doc = await (await expensesCollection()).findOneAndUpdate(
    { _id: id, updatedAt: expected },
    { $set: { status, updatedAt: new Date(updatedAt) } },
    { returnDocument: "after", projection: REF_PROJECTION }
  );
  return doc ? expenseReads.pickFromDoc(doc, REF_FIELDS) : null;
}
