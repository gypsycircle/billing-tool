// components/expenses/expense-status.tsx
// What the archive confirmation says about an expense (row menu and expense page).

import { numberedArchiveCopy } from "@/components/shared/archive-dialog";
import { formatAmount } from "@/lib/domain/money";
import { expenseTypeLabel, type ExpenseActionTarget } from "@/lib/domain/expenses";

export const expenseArchiveCopy = (expense: Pick<ExpenseActionTarget, "expenseNumber" | "expenseType" | "amount">) =>
  numberedArchiveCopy(
    "expense",
    expense.expenseNumber,
    <>
      This {expenseTypeLabel(expense.expenseType).toLowerCase()} expense of ₹{formatAmount(expense.amount)} will be hidden from the list and
      left out of the totals.
    </>
  );
