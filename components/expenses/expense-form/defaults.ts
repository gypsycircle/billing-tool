// components/expenses/expense-form/defaults.ts
// Starting values for the expense form. Plain module (no "use client") so
// server pages can build them.

import type { DefaultValues } from "react-hook-form";
import type { z } from "zod";
import type { expenseDraftSchema } from "@/lib/domain/expense.schema";
import { paidForInput, type Expense } from "@/lib/domain/expenses";

/** What the form holds while editing (before Zod trims/validates). */
export type ExpenseFormInput = z.input<typeof expenseDraftSchema>;
/** What the form submits (validated). */
export type ExpenseFormValues = z.output<typeof expenseDraftSchema>;

/** A new expense: no type chosen yet (so nothing paid for), amount empty (NaN), dated today. */
export function newExpenseDefaults(today: string): DefaultValues<ExpenseFormInput> {
  return { amount: Number.NaN, expenseDate: today, paidForId: "", paidForText: "", note: "" };
}

/** The editable fields of a saved expense (empty paid-for fields if it was saved before they existed). */
export function expenseFormDefaults(expense: Expense): ExpenseFormInput {
  return {
    expenseType: expense.expenseType,
    amount: expense.amount,
    expenseDate: expense.expenseDate,
    ...paidForInput(expense.expenseType, expense.paidFor),
    note: expense.note,
  };
}
