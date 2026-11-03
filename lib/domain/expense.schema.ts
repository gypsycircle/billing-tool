// lib/domain/expense.schema.ts
// Zod schemas for expenses — shared by the expense form (client), the API and
// the service, so every layer enforces the same rules.

import { z } from "zod";
import { compareDDMMYYYY, isValidDDMMYYYY } from "./dates";
import { EXPENSE_TYPE_IDS, MARKETING_OTHER, PAID_FOR_TEXT_MAX, paidForOf, type ExpenseDraft } from "./expenses";
import { crossFieldRule, ddmmyyyy, optionalText, recordIdSchema, rupees } from "./field-rules";

export const expenseIdSchema = recordIdSchema("expense");

/** Largest single expense: ₹1 crore. */
const MAX_AMOUNT = 1_00_00_000;

const expenseObject = z.object({
  expenseType: z.enum(EXPENSE_TYPE_IDS, { error: "Choose an expense type." }),
  amount: rupees("Amount spent", 1).max(MAX_AMOUNT, "Amount spent can be at most ₹1,00,00,000."),
  expenseDate: ddmmyyyy("Expense date"),
  paidForId: z.string().trim().max(64, "Choose from the list."),
  paidForText: optionalText("Description", PAID_FOR_TEXT_MAX),
  note: optionalText("Note", 500),
}) satisfies z.ZodType<ExpenseDraft, unknown>;

/** A create may leave out the "paid for" field its type doesn't use (no defaults on edits: they'd blank the saved one). */
const expenseCreateObject = expenseObject.extend({
  paidForId: expenseObject.shape.paidForId.default(""),
  paidForText: expenseObject.shape.paidForText.default(""),
});

const isId = (value: string) => z.uuid().safeParse(value).success;

/**
 * "Paid for" as the type needs it: an ID from the right list (team member,
 * package, channel), "Other" with a description (marketing), or text (wages,
 * miscellaneous). The server then checks the ID is in that list and active.
 */
function paidForIssue({ expenseType, paidForId, paidForText }: Pick<ExpenseDraft, "expenseType" | "paidForId" | "paidForText">) {
  const { source, missing } = paidForOf(expenseType);
  if (source === "text") return paidForText ? null : { path: "paidForText", message: missing };
  if (source === "marketing" && paidForId === MARKETING_OTHER) {
    return paidForText ? null : { path: "paidForText", message: "Describe the marketing, e.g. Flyers at college fest." };
  }
  return isId(paidForId) ? null : { path: "paidForId", message: missing };
}

/** Runs once the type and both paid-for fields are valid, so its error shows with the rest. */
const paidForRule = crossFieldRule<ExpenseDraft>(["expenseType", "paidForId", "paidForText"], (data, ctx) => {
  const issue = paidForIssue(data);
  if (issue) ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
});

/** An expense can't be dated after today (IST). Null when fine (or not a valid date yet). */
export function expenseDateIssue(expenseDate: string, today: string): string | null {
  if (!isValidDDMMYYYY(expenseDate) || !isValidDDMMYYYY(today)) return null;
  return compareDDMMYYYY(expenseDate, today) > 0 ? "Expense date can't be in the future." : null;
}

/**
 * Create (and a whole expense after an edit): what the user enters, with the
 * right "paid for" for the type. The server adds the number, the kind, the
 * paid-for name and the timestamps.
 */
export const expenseDraftSchema = expenseCreateObject.superRefine(...paidForRule);

/** The expense form: the draft plus "not after today" (`today` in IST, DD/MM/YYYY). */
export function expenseFormSchema(today: string) {
  return expenseDraftSchema.superRefine(
    ...crossFieldRule<ExpenseDraft>(["expenseDate"], (data, ctx) => {
      const message = expenseDateIssue(data.expenseDate, today);
      if (message) ctx.addIssue({ code: "custom", path: ["expenseDate"], message });
    })
  );
}

/**
 * Update: any subset of the fields the user enters; unknown keys (the number,
 * the kind, the status) are rejected. The service merges the update onto the
 * stored expense and re-validates it.
 */
export const updateExpenseSchema = expenseObject
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "No changes were provided.");
