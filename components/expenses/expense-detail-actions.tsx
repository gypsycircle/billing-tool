// components/expenses/expense-detail-actions.tsx
// Actions in the expense page's header: Edit, and More (archive / restore).

"use client";

import { RecordDetailActions } from "@/components/shared/record-menus";
import type { ExpenseActionTarget } from "@/lib/domain/expenses";
import { isArchived } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import { useExpenseActions } from "@/hooks/use-expense-actions";
import { expenseArchiveCopy } from "./expense-status";

export function ExpenseDetailActions({ expense }: { expense: ExpenseActionTarget }) {
  return (
    <RecordDetailActions
      editHref={routes.expenses.edit(expense.expenseId)}
      archived={isArchived(expense)}
      actions={useExpenseActions(expense)}
      copy={expenseArchiveCopy(expense)}
    />
  );
}
