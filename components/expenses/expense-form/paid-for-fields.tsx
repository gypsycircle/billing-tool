// components/expenses/expense-form/paid-for-fields.tsx
// Where the money went, as the chosen type needs it: a team member (salary),
// a package (package cost), a channel or Other with a description
// (marketing), or typed text (wages, miscellaneous). The dropdowns come from
// Settings, and link there for what isn't listed.

"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { formFields } from "@/components/forms/fields";
import { ListSelectField } from "@/components/forms/list-select-field";
import {
  EXPENSE_TYPES,
  MARKETING_OTHER,
  PAID_FOR_LIST_NAMES,
  PAID_FOR_TEXT_MAX,
  paidForOf,
  type ExpenseType,
  type PaidForOptions,
} from "@/lib/domain/expenses";
import type { ExpenseFormInput } from "./defaults";

const { TextField } = formFields<ExpenseFormInput>();

/** The typed ones (required): an example, and what to say. */
const TYPED: Partial<Record<ExpenseType, { example: string; hint: string }>> = {
  wages: { example: "e.g. Guide expense", hint: "What the wage was paid for." },
  miscellaneous: { example: "e.g. Office supplies", hint: "What the money was spent on." },
};

export function PaidForFields({ options }: { options: PaidForOptions }) {
  const { control } = useFormContext<ExpenseFormInput>();
  const [type, paidForId] = useWatch({ control, name: ["expenseType", "paidForId"] });

  if (!type || !(type in EXPENSE_TYPES)) {
    return <p className="text-sm text-muted-foreground sm:col-span-2">Choose the expense type first: what goes here depends on it.</p>;
  }

  const { source, label } = paidForOf(type as ExpenseType);
  if (source === "text") {
    const typed = TYPED[type as ExpenseType];
    return (
      <TextField name="paidForText" label={label} maxLength={PAID_FOR_TEXT_MAX} placeholder={typed?.example} hint={typed?.hint} required autoComplete="off" />
    );
  }

  const listed = options[source];
  const choices: Record<string, string> = Object.fromEntries(listed.map((o) => [o.id, o.detail ? `${o.name} · ${o.detail}` : o.name]));
  if (source === "marketing") choices[MARKETING_OTHER] = "Other (describe it)";

  return (
    <>
      <ListSelectField<ExpenseFormInput>
        name="paidForId"
        label={label}
        choices={choices}
        list={source}
        things={PAID_FOR_LIST_NAMES[source]}
        required
        alternative={source === "marketing" ? "Pick Other" : undefined}
      />
      {source === "marketing" && paidForId === MARKETING_OTHER && (
        <TextField
          name="paidForText"
          label="Describe it"
          maxLength={PAID_FOR_TEXT_MAX}
          placeholder="e.g. Flyers at college fest"
          required
          autoComplete="off"
        />
      )}
    </>
  );
}
