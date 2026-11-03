// lib/server/db/expense-query.ts
// The expenses list's filters → MongoDB queries. Pure (no I/O). Each has an
// index in collections.ts to serve it; expenses.test.ts checks the answers
// and the plans.

import "server-only";

import type { Document, Filter } from "mongodb";
import type { ExpenseFilters } from "@/lib/domain/expense-filters";
import { MARKETING_OTHER } from "@/lib/domain/expenses";
import type { ExpenseDoc } from "./collections";
import { withinDays } from "./mapping";

/** Newest expense date first; the _id tie-breaker keeps pages stable (status_expenseDate_id index). */
export const NEWEST_EXPENSE_FIRST = { expenseDate: -1, _id: 1 } as const;

/** The list's filter: archived expenses only in the archived view, otherwise active ones. */
export function expenseMatch(filters: ExpenseFilters): Filter<ExpenseDoc> {
  const expenseDate = withinDays(filters);
  return {
    status: filters.archived ? "Archived" : "Active",
    ...(filters.kind ? { expenseKind: filters.kind } : {}),
    ...(filters.type ? { expenseType: filters.type } : {}),
    // Who or what was paid (parsing keeps it only with its type); Other is marketing typed in, not picked
    ...(filters.paidFor === MARKETING_OTHER
      ? { paidFor: { $exists: true }, "paidFor.refId": null }
      : filters.paidFor
        ? { "paidFor.refId": filters.paidFor }
        : {}),
    // The expense date ends every list index, so a range is read straight off it
    ...(expenseDate ? { expenseDate } : {}),
  };
}

/** Count and total of every matching expense. */
export const expenseTotalsGroup: Document[] = [{ $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } }];

/** The two tiles: active expenses, totalled per kind (direct / indirect). */
export const expenseKindsGroup: Document[] = [
  { $match: { status: "Active" } },
  { $group: { _id: "$expenseKind", total: { $sum: "$amount" }, count: { $sum: 1 } } },
];
