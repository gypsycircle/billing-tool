// lib/domain/expense-filters.ts
// The expenses list's filters and page, parsed from the URL (never trusted).
// The database applies them (lib/server/db/expense-query.ts).

import { z } from "zod";
import { EXPENSE_KINDS, EXPENSE_TYPE_IDS, MARKETING_OTHER, paidForListOf, type ExpenseKind, type ExpenseType } from "./expenses";
import { dateRangeParams, orderedRange } from "./date-range";
import { flag, isoDayParam, oneOf, pageParam, param } from "./filters";

/** True when the type's paid for comes from a list (team, packages, channels), so the list can filter by it. */
export const hasPaidForFilter = (type: ExpenseType | undefined): type is ExpenseType => !!type && paidForListOf(type) !== null;

const expenseFiltersSchema = z
  .object({
    kind: oneOf(Object.keys(EXPENSE_KINDS) as ExpenseKind[]),
    type: oneOf(EXPENSE_TYPE_IDS),
    /** Who or what was paid: a team member, package or channel ID, or "other" (marketing). Needs its type. */
    paidFor: param.transform((v) => (z.uuid().safeParse(v).success || v === MARKETING_OTHER ? v : undefined)),
    archived: flag,
    /** Expense date from / to (DD/MM/YYYY; "" for an open end). */
    from: isoDayParam,
    to: isoDayParam,
    page: pageParam,
  })
  .transform(({ paidFor, ...filters }) => {
    const list = filters.type ? paidForListOf(filters.type) : null;
    const kept = list !== null && (paidFor !== MARKETING_OTHER || list === "marketing");
    return { ...filters, ...orderedRange(filters), paidFor: kept ? paidFor : undefined };
  });

export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;

/** Reads filters from Next.js searchParams; unknown or malformed values are dropped. */
export function parseExpenseFilters(params: Record<string, string | string[] | undefined>): ExpenseFilters {
  return expenseFiltersSchema.parse(params);
}

/** The filters that are set, as URL parameters (for page links). */
export function expenseFilterParams(filters: ExpenseFilters): Record<string, string> {
  return { kind: filters.kind ?? "", type: filters.type ?? "", paidFor: filters.paidFor ?? "", archived: filters.archived ? "1" : "", ...dateRangeParams(filters) };
}

/** True when any filter narrows the list (used for "no results" vs "empty"). */
export function hasActiveExpenseFilters(filters: ExpenseFilters): boolean {
  return Boolean(filters.kind || filters.type || filters.paidFor || filters.archived || filters.from || filters.to);
}
