// components/expenses/expense-form/expense-summary.tsx
// The expense as it will be saved, updated as the user types (SummaryCard):
// type and its kind, where the money went, date, and the amount (also in
// words). Preview only.

"use client";

import { useWatch, type Control } from "react-hook-form";
import { ReceiptText } from "lucide-react";
import { SummaryCard, SummaryRow, SummaryTotal } from "@/components/forms/summary-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDisplayDate, isValidDDMMYYYY } from "@/lib/domain/dates";
import { EXPENSE_TYPES, expenseTypeLabel, paidForLabel, paidForOf, paidForPreview, type ExpenseType, type PaidForOptions } from "@/lib/domain/expenses";
import type { ExpenseFormInput } from "./defaults";

export function ExpenseSummary({ control, options }: { control: Control<ExpenseFormInput>; options: PaidForOptions }) {
  const [type, amount, date, paidForId, paidForText] = useWatch({
    control,
    name: ["expenseType", "amount", "expenseDate", "paidForId", "paidForText"],
  });
  const known = type && type in EXPENSE_TYPES ? (type as ExpenseType) : null;
  const validAmount = Number.isSafeInteger(amount) && amount > 0;
  const ready = known && validAmount;

  return (
    <SummaryCard
      label="Summary"
      badge={known && <StatusBadge value={EXPENSE_TYPES[known].kind} />}
      words={ready ? { label: "Amount (in words)", amount } : null}
      empty={{ icon: ReceiptText, message: "Choose the type and enter the amount to see the expense here." }}
    >
      {ready && (
        <>
          <SummaryRow label="Type">{expenseTypeLabel(known)}</SummaryRow>
          <SummaryRow label={paidForOf(known).label} valueClassName="min-w-0 text-right break-words">
            {paidForLabel(known, paidForPreview(known, { paidForId: paidForId ?? "", paidForText: paidForText ?? "" }, options))}
          </SummaryRow>
          <SummaryRow label="Date" valueClassName="tabular">
            {isValidDDMMYYYY(String(date ?? "")) ? formatDisplayDate(String(date)) : "—"}
          </SummaryRow>
          <SummaryTotal label="Amount" amount={amount} />
        </>
      )}
    </SummaryCard>
  );
}
