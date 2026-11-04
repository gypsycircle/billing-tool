// components/expenses/expense-form/expense-form.tsx
// Create / edit an expense, laid out like the booking form (numbered sections,
// a live summary and the save buttons on the side). Validation is the Zod
// schema the API uses; the server assigns the number and the kind on save,
// and checks "paid for" against its list.

"use client";

import type { DefaultValues } from "react-hook-form";
import { formFields, ReadOnlyField } from "@/components/forms/fields";
import { FormSection } from "@/components/forms/form-section";
import { RecordFormLayout } from "@/components/forms/record-form-layout";
import { changedFields } from "@/lib/client/changed-fields";
import { EXPENSE_TYPE_OPTIONS, type ExpenseRef, type PaidForOptions } from "@/lib/domain/expenses";
import { routes } from "@/lib/domain/routes";
import { useExpenseForm } from "@/hooks/use-expense-form";
import { useRecordFormSubmit } from "@/hooks/use-record-form-submit";
import type { ExpenseFormInput, ExpenseFormValues } from "./defaults";
import { ExpenseSummary } from "./expense-summary";
import { PaidForFields } from "./paid-for-fields";

const { DateField, NumberField, SelectField, TextareaField } = formFields<ExpenseFormInput>();

/** The type and its "paid for" are checked as a pair, so an edit that changes one sends all three. */
const PAID_FOR_PAIR = ["expenseType", "paidForId", "paidForText"] as const;

function editChanges(values: ExpenseFormValues, dirty: Parameters<typeof changedFields>[1]): Partial<ExpenseFormValues> {
  const changes = changedFields(values, dirty);
  if (PAID_FOR_PAIR.some((key) => key in changes)) for (const key of PAID_FOR_PAIR) Object.assign(changes, { [key]: values[key] });
  return changes;
}

type ExpenseFormProps = {
  defaultValues: DefaultValues<ExpenseFormInput>;
  /** The expense's number: the expected one for a new expense. */
  number: string;
  /** Today (IST, DD/MM/YYYY): the latest date an expense can have. */
  today: string;
  /** The paid-for dropdowns (getPaidForOptions). */
  options: PaidForOptions;
} & (
  | { mode: "create" }
  | {
      mode: "edit";
      expenseId: string;
      /** The expense's updatedAt when the form was opened — sent as X-Record-Version. */
      version: string;
    }
);

export function ExpenseForm(props: ExpenseFormProps) {
  const { mode, defaultValues, number, today, options } = props;
  const { form, applyServerErrors } = useExpenseForm(defaultValues, today);
  const submit = useRecordFormSubmit<ExpenseFormInput, ExpenseFormValues, { expense: ExpenseRef }>({
    form,
    target:
      props.mode === "create"
        ? { mode: "create", url: routes.api.expenses.list }
        : { mode: "edit", url: routes.api.expenses.one(props.expenseId), version: props.version },
    applyServerErrors,
    editBody: editChanges,
    onSaved: ({ expense }) => ({
      message: `Expense No. ${expense.expenseNumber} ${mode === "create" ? "added" : "updated"}.`,
      href: routes.expenses.page(expense.expenseId),
    }),
  });

  return (
    <RecordFormLayout
      form={form}
      onSubmit={submit.onSubmit}
      summary={<ExpenseSummary control={form.control} options={options} />}
      submit={{
        ...submit,
        label: mode === "create" ? "Add expense" : "Save changes",
        cancelHref: props.mode === "edit" ? routes.expenses.page(props.expenseId) : routes.expenses.list,
      }}
    >
      <FormSection number="01" title="Expense" description="Its number, and the day the money was spent.">
        <ReadOnlyField
          id="expenseNumber"
          label="Expense No."
          value={number}
          hint={mode === "create" ? "The next free number, confirmed when you save." : undefined}
        />
        <DateField name="expenseDate" label="Expense date" max={today} required />
      </FormSection>

      <FormSection
        number="02"
        title="Type and amount"
        description="Direct costs run the trips; indirect costs run the business."
      >
        <SelectField
          name="expenseType"
          label="Expense type"
          options={EXPENSE_TYPE_OPTIONS}
          placeholder="Choose a type…"
          hint="Direct or indirect follows the type."
          required
        />
        <NumberField name="amount" label="Amount spent" required />
      </FormSection>

      <FormSection number="03" title="Paid for" description="Where the money went.">
        <PaidForFields options={options} />
      </FormSection>

      <FormSection number="04" title="Note">
        <TextareaField
          name="note"
          label="Note"
          maxLength={500}
          hint="Optional — anything else worth keeping with it."
          placeholder="e.g. Camp fees for the Kedarkantha batch"
          className="sm:col-span-2"
        />
      </FormSection>
    </RecordFormLayout>
  );
}
