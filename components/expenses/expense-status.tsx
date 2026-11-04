// components/expenses/expense-status.tsx
// What the archive confirmation says about an expense (row menu and expense page).

import type { ArchiveCopy } from "@/components/shared/archive-dialog";
import { formatAmount } from "@/lib/domain/money";
import type { ExpenseActionTarget } from "@/lib/domain/expenses";

export const expenseArchiveCopy = (expense: Pick<ExpenseActionTarget, "expenseNumber" | "amount">): ArchiveCopy => ({
  recordLabel: "expense",
  reference: expense.expenseNumber,
  description: `This ₹${formatAmount(expense.amount)} expense will be hidden and left out of the totals.`,
});
