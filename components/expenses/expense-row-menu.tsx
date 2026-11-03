// components/expenses/expense-row-menu.tsx
// The "⋯" menu on each expense row: the shared record menu (Open, Edit,
// Archive… / Restore).

"use client";

import { RecordRowMenu } from "@/components/shared/record-menus";
import type { ExpenseActionTarget } from "@/lib/domain/expenses";
import { isArchived } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import { useExpenseActions } from "@/hooks/use-expense-actions";
import { expenseArchiveCopy } from "./expense-status";

export function ExpenseRowMenu({ expense }: { expense: ExpenseActionTarget }) {
  return (
    <RecordRowMenu
      label={`expense No. ${expense.expenseNumber}`}
      href={routes.expenses.page(expense.expenseId)}
      editHref={routes.expenses.edit(expense.expenseId)}
      archived={isArchived(expense)}
      actions={useExpenseActions(expense, { inList: true })}
      copy={expenseArchiveCopy(expense)}
    />
  );
}
