// hooks/use-expense-form.ts
// The expense form (useRecordForm, with the API's schema plus "not after
// today"). "Paid for" belongs to the type, so a new type starts it empty, and
// leaving marketing's Other drops its description.

"use client";

import { useEffect, useMemo } from "react";
import type { DefaultValues } from "react-hook-form";
import { expenseDraftSchema, expenseFormSchema } from "@/lib/domain/expense.schema";
import { MARKETING_OTHER } from "@/lib/domain/expenses";
import type { ExpenseFormInput, ExpenseFormValues } from "@/components/expenses/expense-form/defaults";
import { useRecordForm } from "./use-record-form";

const EXPENSE_FIELDS: readonly string[] = Object.keys(expenseDraftSchema.shape);

export function useExpenseForm(defaultValues: DefaultValues<ExpenseFormInput>, today: string) {
  const schema = useMemo(() => expenseFormSchema(today), [today]);
  const { form, applyServerErrors } = useRecordForm<ExpenseFormInput, ExpenseFormValues>({ schema, defaultValues, fields: EXPENSE_FIELDS });

  useEffect(() => {
    const { setValue, clearErrors } = form;
    const clear = (name: "paidForId" | "paidForText") => setValue(name, "", { shouldDirty: true });
    return form.subscribe({
      name: ["expenseType", "paidForId"],
      formState: { values: true },
      // Only the user's own changes (the setValue calls here don't come back as one)
      callback: ({ values, name, type }) => {
        if (type !== "change") return;
        if (name === "expenseType") {
          clear("paidForId");
          clear("paidForText");
          clearErrors(["paidForId", "paidForText"]);
        } else if (name === "paidForId" && values.paidForId !== MARKETING_OTHER && values.paidForText) {
          clear("paidForText");
        }
      },
    });
  }, [form]);

  return { form, applyServerErrors };
}
