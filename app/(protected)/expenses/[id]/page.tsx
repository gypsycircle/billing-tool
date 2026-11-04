// app/(protected)/expenses/[id]/page.tsx
// One expense: its number, date, type, kind, status, what for, amount and note.

import type { Metadata } from "next";
import { PageGroup } from "@/components/shared/page-body";
import { ExpenseDetailActions } from "@/components/expenses/expense-detail-actions";
import { ExpenseDocument } from "@/components/expenses/expense-document";
import { ArchivedNotice, RecordPageHeader } from "@/components/shared/record-headers";
import { StatusBadge } from "@/components/shared/status-badge";
import { expenseActionTargetOf, expenseTypeLabel, paidForLabel, expenseStatusBadge } from "@/lib/domain/expenses";
import { isArchived } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import { getExpense } from "@/lib/server/expenses/service";
import { orNotFound } from "@/lib/server/records/load-for-page";

export const metadata: Metadata = { title: "Expense" };

export default async function ExpensePage({ params }: PageProps<"/expenses/[id]">) {
  const { id } = await params;
  const expense = await orNotFound(() => getExpense(id));
  const archived = isArchived(expense);

  return (
    <>
      <RecordPageHeader
        back={{ href: routes.expenses.list, label: "Expenses" }}
        eyebrow={`Expense No. ${expense.expenseNumber}`}
        title={expenseTypeLabel(expense.expenseType)}
        badges={
          <>
            <StatusBadge value={expenseStatusBadge(expense.status)} />
            <StatusBadge value={expense.expenseKind} />
          </>
        }
        detail={expense.paidFor && paidForLabel(expense.expenseType, expense.paidFor)}
        updatedAt={expense.updatedAt}
        actions={<ExpenseDetailActions expense={expenseActionTargetOf(expense)} />}
      />

      <PageGroup>
        {archived && <ArchivedNotice what="expense" hidden="hidden from the list and left out of the totals" />}
        <ExpenseDocument expense={expense} />
      </PageGroup>
    </>
  );
}
