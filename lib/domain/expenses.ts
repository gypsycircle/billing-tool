// lib/domain/expenses.ts
// Expenses: what the business spends. Each has a fixed type, and the type
// decides whether it is a direct cost (spent to run trips) or an indirect one
// (spent to run the business). The kind is always derived from the type, by
// the server, never chosen by the user. Every expense also says where the
// money went ("paid for"), and what that is depends on the type: a team
// member (salary), a package (package cost), a marketing channel or a short
// description (marketing), or typed text (wages, miscellaneous).
//   Gross profit = revenue − direct expenses
//   Net profit   = gross profit − indirect expenses

import { GENERAL_KINDS } from "./general";
import { formatYearlyNumber } from "./invoice-number";
import type { NamedOption } from "./named-records";
import { ARCHIVABLE_STATUSES, type ArchivableStatus } from "./records";

export const EXPENSE_KINDS = { direct: "Direct", indirect: "Indirect" } as const;
export type ExpenseKind = keyof typeof EXPENSE_KINDS;

/**
 * Where "paid for" comes from: the team list, the packages or marketing
 * channels list (general), or text the user types.
 */
type PaidForSource = "team" | "package" | "marketing" | "text";

export const EXPENSE_TYPES = {
  package_cost: { label: "Package cost", kind: "direct", paidFor: { source: "package", label: "Package", missing: "Choose the package." } },
  wages: { label: "Wages", kind: "direct", paidFor: { source: "text", label: "What for", missing: "Say what the wage was for, e.g. Guide expense." } },
  marketing: { label: "Marketing", kind: "indirect", paidFor: { source: "marketing", label: "Channel", missing: "Choose the channel." } },
  salary: { label: "Salary", kind: "indirect", paidFor: { source: "team", label: "Team member", missing: "Choose the team member." } },
  miscellaneous: { label: "Miscellaneous", kind: "indirect", paidFor: { source: "text", label: "What for", missing: "Say what it was for." } },
} as const satisfies Record<string, { label: string; kind: ExpenseKind; paidFor: { source: PaidForSource; label: string; missing: string } }>;
export type ExpenseType = keyof typeof EXPENSE_TYPES;
export const EXPENSE_TYPE_IDS = Object.keys(EXPENSE_TYPES) as [ExpenseType, ...ExpenseType[]];

export const EXPENSE_STATUSES = ARCHIVABLE_STATUSES;
export type ExpenseStatus = ArchivableStatus;

export const expenseKindOf = (type: ExpenseType): ExpenseKind => EXPENSE_TYPES[type].kind;
export const paidForOf = (type: ExpenseType) => EXPENSE_TYPES[type].paidFor;

/** The marketing choice that isn't a listed channel: the user describes it. */
export const MARKETING_OTHER = "other";

/** Longest typed "paid for" (wages, miscellaneous, marketing Other). */
export const PAID_FOR_TEXT_MAX = 100;

/**
 * Where the money went, as saved: the team member, package or channel it was
 * picked from (`refId`) and its name then, or typed text (`refId` null).
 * The name is a snapshot, so a later rename never changes this expense.
 */
export interface PaidFor {
  refId: string | null;
  label: string;
}
export const expenseTypeLabel = (type: ExpenseType): string => EXPENSE_TYPES[type].label;

/** Labels for a type picker: "Package cost · Direct". */
export const EXPENSE_TYPE_OPTIONS: Readonly<Record<ExpenseType, string>> = Object.fromEntries(
  EXPENSE_TYPE_IDS.map((type) => [type, `${expenseTypeLabel(type)} · ${EXPENSE_KINDS[expenseKindOf(type)]}`])
) as Record<ExpenseType, string>;

/**
 * One expense. Dates are DD/MM/YYYY; timestamps are ISO 8601; money is whole
 * rupees. `expenseNumber` (EXP_{year}{counter}) and `expenseKind` are assigned
 * by the server.
 */
export interface Expense {
  expenseId: string;
  expenseNumber: string;
  expenseType: ExpenseType;
  expenseKind: ExpenseKind;
  amount: number;
  expenseDate: string;
  /** Null only on expenses saved before "paid for" existed; their next edit asks for it. */
  paidFor: PaidFor | null;
  note: string;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * What the user enters. "Paid for" is entered as `paidForId` (a team member,
 * package or channel ID, or MARKETING_OTHER) and/or `paidForText`; the server
 * turns them into `paidFor`.
 */
export interface ExpenseDraft extends Pick<Expense, "expenseType" | "amount" | "expenseDate" | "note"> {
  paidForId: string;
  paidForText: string;
}

/** The lists "paid for" is picked from: the form's dropdowns, active choices by name. */
export type PaidForList = Exclude<PaidForSource, "text">;
export type PaidForOptions = Record<PaidForList, NamedOption[]>;

/** The list a type's paid for is picked from, or null when it's typed. */
export function paidForListOf(type: ExpenseType): PaidForList | null {
  const { source } = paidForOf(type);
  return source === "text" ? null : source;
}

/** What each of those lists holds, in words: "team members", "packages", "marketing channels". */
export const PAID_FOR_LIST_NAMES: Readonly<Record<PaidForList, string>> = {
  team: "team members",
  package: GENERAL_KINDS.package.title.toLowerCase(),
  marketing: GENERAL_KINDS.marketing.title.toLowerCase(),
};

/** How a "paid for" reads: the name or the text ("Other · …" for typed-in marketing); "—" when there is none. */
export function paidForLabel(type: ExpenseType, paidFor: PaidFor | null): string {
  if (!paidFor) return "—";
  return paidForOf(type).source === "marketing" && !paidFor.refId ? `Other · ${paidFor.label}` : paidFor.label;
}

/**
 * What the form's paid-for fields will save, for the live summary: the picked
 * option's name or the typed text (the server checks and stores the real one).
 * Null while nothing usable is entered.
 */
export function paidForPreview(
  type: ExpenseType,
  { paidForId, paidForText }: Pick<ExpenseDraft, "paidForId" | "paidForText">,
  options: PaidForOptions
): PaidFor | null {
  const { source } = paidForOf(type);
  if (source === "text" || paidForId === MARKETING_OTHER) {
    const label = paidForText.trim();
    return label ? { refId: null, label } : null;
  }
  const picked = options[source].find((option) => option.id === paidForId);
  return picked ? { refId: picked.id, label: picked.name } : null;
}

/** A saved "paid for" as the form's two fields (the reverse of what the server stores). */
export function paidForInput(type: ExpenseType, paidFor: PaidFor | null): Pick<ExpenseDraft, "paidForId" | "paidForText"> {
  if (!paidFor) return { paidForId: "", paidForText: "" };
  if (paidFor.refId) return { paidForId: paidFor.refId, paidForText: "" };
  return { paidForId: paidForOf(type).source === "marketing" ? MARKETING_OTHER : "", paidForText: paidFor.label };
}

/** One row of the expenses list: what the table shows, plus what its menu needs. */
export const EXPENSE_ROW_FIELDS = [
  "expenseId",
  "expenseNumber",
  "updatedAt",
  "expenseType",
  "expenseKind",
  "amount",
  "expenseDate",
  "paidFor",
  "note",
  "status",
] as const satisfies readonly (keyof Expense)[];

export type ExpenseRow = Pick<Expense, (typeof EXPENSE_ROW_FIELDS)[number]>;

/** What a write returns (POST, PATCH, DELETE): enough to link to the expense and keep editing it. */
export type ExpenseRef = Pick<Expense, "expenseId" | "expenseNumber" | "updatedAt" | "status">;

export function expenseRefOf(expense: ExpenseRef): ExpenseRef {
  const { expenseId, expenseNumber, updatedAt, status } = expense;
  return { expenseId, expenseNumber, updatedAt, status };
}

/** What the status actions and the archive confirmation need (row menu, expense page). */
export type ExpenseActionTarget = ExpenseRef & Pick<Expense, "expenseType" | "amount">;

export function expenseActionTargetOf(expense: ExpenseActionTarget): ExpenseActionTarget {
  return { ...expenseRefOf(expense), expenseType: expense.expenseType, amount: expense.amount };
}

/** EXP_{year}{counter}, the counter at least 4 digits: EXP_20260001. */
export function formatExpenseNumber(year: number, sequence: number): string {
  return formatYearlyNumber("EXP", year, sequence);
}

/** The year's first expense number. */
export const FIRST_EXPENSE_NUMBER = 1;
