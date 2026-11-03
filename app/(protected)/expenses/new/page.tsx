// app/(protected)/expenses/new/page.tsx
// New expense. The number it will most likely get is shown read-only; the
// server assigns it (and the kind) when it is saved.

import type { Metadata } from "next";
import { ExpenseForm } from "@/components/expenses/expense-form/expense-form";
import { newExpenseDefaults } from "@/components/expenses/expense-form/defaults";
import { NewRecordHeader } from "@/components/shared/record-headers";
import { routes } from "@/lib/domain/routes";
import { todayIST } from "@/lib/domain/dates";
import { getPaidForOptions, suggestExpenseNumber } from "@/lib/server/expenses/service";

export const metadata: Metadata = { title: "New expense" };

export default async function NewExpensePage() {
  const [number, options] = await Promise.all([suggestExpenseNumber(), getPaidForOptions()]);
  const today = todayIST();

  return (
    <>
      <NewRecordHeader
        back={{ href: routes.expenses.list, label: "Expenses" }}
        title="New expense"
        description="Record what was spent — its type decides whether it's a direct or an indirect cost."
      />
      <ExpenseForm mode="create" defaultValues={newExpenseDefaults(today)} number={number} today={today} options={options} />
    </>
  );
}
