// app/(protected)/expenses/[id]/edit/page.tsx
// Edit an expense. Archived expenses must be restored before editing; one
// saved before "paid for" existed is asked for it here.

import type { Metadata } from "next";
import { ExpenseForm } from "@/components/expenses/expense-form/expense-form";
import { expenseFormDefaults } from "@/components/expenses/expense-form/defaults";
import { EditRecordHeader } from "@/components/shared/record-headers";
import { StatusNotice } from "@/components/shared/status-notice";
import { todayIST } from "@/lib/domain/dates";
import { expenseTypeLabel } from "@/lib/domain/expenses";
import { routes } from "@/lib/domain/routes";
import { getExpense, getPaidForOptions } from "@/lib/server/expenses/service";
import { orNotFound, redirectIfArchived } from "@/lib/server/records/load-for-page";

export const metadata: Metadata = { title: "Edit expense" };

export default async function EditExpensePage({ params }: PageProps<"/expenses/[id]/edit">) {
  const { id } = await params;
  const expense = await orNotFound(() => getExpense(id));
  redirectIfArchived(expense, routes.expenses.page(expense.expenseId));
  const options = await getPaidForOptions(expense);

  return (
    <>
      <EditRecordHeader
        back={{ href: routes.expenses.page(expense.expenseId), label: `Expense No. ${expense.expenseNumber}` }}
        number={expense.expenseNumber}
        title={expenseTypeLabel(expense.expenseType)}
        description="Change what you need — a new type brings its kind with it."
      />
      {!expense.paidFor && <StatusNotice>This expense was saved before expenses said where the money went. Fill in Paid for to save your changes.</StatusNotice>}
      <ExpenseForm
        mode="edit"
        expenseId={expense.expenseId}
        version={expense.updatedAt}
        defaultValues={expenseFormDefaults(expense)}
        number={expense.expenseNumber}
        today={todayIST()}
        options={options}
      />
    </>
  );
}
