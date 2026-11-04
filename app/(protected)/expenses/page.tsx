// app/(protected)/expenses/page.tsx
// The expenses list: the Direct / Indirect tiles, filters and the table.
// Filters and the page come from the URL and are applied here on the server.

import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { ExpenseFilters } from "@/components/expenses/expense-filters";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { NoMatches, NothingYet } from "@/components/shared/list-empty-states";
import { Money } from "@/components/shared/money";
import { NewRecordButton } from "@/components/shared/new-record-button";
import { PageBody } from "@/components/shared/page-body";
import { PageHeader } from "@/components/shared/page-header";
import { RecordList } from "@/components/shared/record-list";
import { Stat, StatGroup } from "@/components/shared/stat";
import { pastDatePresets } from "@/lib/domain/date-range";
import { todayIST } from "@/lib/domain/dates";
import { expenseFilterParams, hasActiveExpenseFilters, parseExpenseFilters } from "@/lib/domain/expense-filters";
import { EXPENSE_TYPE_IDS, EXPENSE_TYPES, type ExpenseKind } from "@/lib/domain/expenses";
import { appliedFilterCount } from "@/lib/domain/filters";
import { routes } from "@/lib/domain/routes";
import { SHORTCUTS } from "@/lib/domain/shortcuts";
import { plural } from "@/lib/domain/words";
import { getExpenseLedger, getPaidForFilterChoices } from "@/lib/server/expenses/service";

export const metadata: Metadata = { title: "Expenses" };

/** "package cost and wages": the types of one kind, for the tile's hint. */
function typesOf(kind: ExpenseKind): string {
  const labels = EXPENSE_TYPE_IDS.filter((t) => EXPENSE_TYPES[t].kind === kind).map((t) => EXPENSE_TYPES[t].label.toLowerCase());
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels.join("");
}

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const filters = parseExpenseFilters(await searchParams);
  // One page of expenses, their totals and the two tiles, and the paid-for
  // filter's choices, from the database in parallel
  const [list, paidForOptions] = await Promise.all([getExpenseLedger(filters), getPaidForFilterChoices()]);
  const { direct, indirect } = list.kinds;
  // The archived view with nothing else narrowing it
  const archivedOnly = filters.archived && !hasActiveExpenseFilters({ ...filters, archived: false });

  return (
    <>
      <PageHeader
        eyebrow="Spending"
        title="Expenses"
        description="What the business spends: direct costs run the trips, indirect costs run the business."
        actions={<NewRecordButton href={routes.expenses.new} label="Add expense" shortcut={SHORTCUTS.newExpense} />}
      />

      <PageBody>
        <StatGroup columns={2}>
          <Stat
            label="Direct expenses"
            value={<Money amount={direct.total} />}
            hint={`${plural(direct.count, "expense")} · ${typesOf("direct")}`}
          />
          <Stat
            label="Indirect expenses"
            value={<Money amount={indirect.total} />}
            hint={`${plural(indirect.count, "expense")} · ${typesOf("indirect")}`}
          />
        </StatGroup>

        <RecordList
          id="ledger"
          empty={
            list.empty && (
              <NothingYet
                icon={Wallet}
                title="No expenses yet"
                description="Expenses you add appear here, split into direct and indirect costs."
                newHref={routes.expenses.new}
                newLabel="Add the first expense"
              />
            )
          }
          filters={<ExpenseFilters applied={appliedFilterCount(expenseFilterParams(filters))} paidForOptions={paidForOptions} datePresets={pastDatePresets(todayIST())} today={todayIST()} />}
          table={<ExpenseTable expenses={list.items} totals={list.totals} archived={filters.archived} />}
          noMatches={<NoMatches plural="expenses" listHref={routes.expenses.list} archivedOnly={archivedOnly} filtered={hasActiveExpenseFilters(filters)} />}
          page={list}
          links={{ path: routes.expenses.list, params: expenseFilterParams(filters) }}
        />
      </PageBody>
    </>
  );
}
