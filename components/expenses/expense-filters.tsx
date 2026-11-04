// components/expenses/expense-filters.tsx
// The expenses list's filters, built from the shared toolbar pieces:
// kind (direct / indirect), type, who or what was paid (for a type picked
// from a list: team member, package or channel), the expense date, and the
// archived view.

"use client";

import { FilterDialog } from "@/components/shared/filter-dialog";
import { FilterArchived, FilterDateRange, FilterSelect } from "@/components/shared/filter-toolbar";
import type { DatePreset } from "@/lib/domain/date-range";
import { EXPENSE_KINDS, EXPENSE_TYPE_IDS, EXPENSE_TYPE_OPTIONS, expenseKindOf, PAID_FOR_LIST_NAMES, paidForListOf, paidForOf, type ExpenseType } from "@/lib/domain/expenses";
import { showArchivedLabel } from "@/lib/domain/records";
import { useFilterDraft } from "@/hooks/use-filter-draft";
import { useUrlFilters } from "@/hooks/use-url-filters";

const FILTER_KEYS = ["kind", "type", "paidFor", "archived", "from", "to"] as const;

/**
 * `applied`: how many filters the server applied. `paidForOptions`: the paid-for
 * filter's choices for each type with a list (getPaidForFilterChoices), as a type
 * picked here isn't in the URL before Apply. `datePresets`: the date filter's quick
 * picks and `today`: the last day an expense can have (both worked out on the server, in India).
 */
export function ExpenseFilters({
  applied,
  paidForOptions,
  datePresets,
  today,
}: {
  applied: number;
  paidForOptions: Partial<Record<ExpenseType, Readonly<Record<string, string>>>>;
  datePresets: readonly DatePreset[];
  today: string;
}) {
  const url = useUrlFilters(FILTER_KEYS);
  const { get, set, discard, apply, reset } = useFilterDraft(url, FILTER_KEYS);
  const type = (EXPENSE_TYPE_IDS as readonly string[]).includes(get("type")) ? (get("type") as ExpenseType) : undefined;
  const list = type ? paidForListOf(type) : null;

  return (
    <FilterDialog count={applied} pending={url.isPending} onApply={apply} onReset={reset} onDiscard={discard}>
      {/* A type has one kind: picking a kind or a type the other contradicts clears the other, as nothing could match both */}
      <FilterSelect
        label="Kind"
        allLabel="Direct and indirect"
        options={EXPENSE_KINDS}
        value={get("kind")}
        onChange={(kind) => set({ kind, ...(type && kind && expenseKindOf(type) !== kind ? { type: "", paidFor: "" } : {}) })}
      />
      {/* Another type has another list, so its paid-for filter starts over */}
      <FilterSelect
        label="Expense type"
        allLabel="All types"
        options={EXPENSE_TYPE_OPTIONS}
        value={get("type")}
        onChange={(next) => set({ type: next, paidFor: "", ...(next && get("kind") && expenseKindOf(next as ExpenseType) !== get("kind") ? { kind: "" } : {}) })}
      />
      {type && list && (
        <FilterSelect
          label={paidForOf(type).label}
          allLabel={`All ${PAID_FOR_LIST_NAMES[list]}`}
          options={paidForOptions[type] ?? {}}
          value={get("paidFor")}
          onChange={(paidFor) => set({ paidFor })}
        />
      )}
      <FilterDateRange label="Expense date" allLabel="Any date" from={get("from")} to={get("to")} presets={datePresets} latest={today} onChange={(from, to) => set({ from, to })} />
      <FilterArchived label={showArchivedLabel("expenses")} checked={get("archived") === "1"} onChange={(on) => set({ archived: on ? "1" : "" })} />
    </FilterDialog>
  );
}
