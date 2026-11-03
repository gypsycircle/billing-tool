// hooks/use-expense-actions.ts
// An expense's archive and restore (useRecordActions, with its path and name).
// `inList`: from a list row, whose archive toast says where to find it again.

"use client";

import type { ExpenseRef } from "@/lib/domain/expenses";
import { routes } from "@/lib/domain/routes";
import { useRecordActions } from "./use-record-actions";

export function useExpenseActions(expense: Pick<ExpenseRef, "expenseId" | "expenseNumber" | "updatedAt">, { inList = false } = {}) {
  return useRecordActions({
    url: routes.api.expenses.one(expense.expenseId),
    version: expense.updatedAt,
    title: `Expense No. ${expense.expenseNumber}`,
    findArchived: inList ? "Show archived" : undefined,
  });
}
