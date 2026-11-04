// components/expenses/expense-table.tsx
// The expenses list: its columns, totals and cards, in the shared table frame.

import Link from "next/link";
import { TableCell } from "@/components/ui/table";
import {
  actionsColumn,
  amountColumn,
  CardFigures,
  CardHeader,
  CardLine,
  CardMeta,
  LedgerTableFrame,
  numberColumn,
  TotalCell,
  TotalsLabelCell,
  type LedgerColumn,
} from "@/components/shared/ledger-table-frame";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDisplayDate } from "@/lib/domain/dates";
import { expenseActionTargetOf, expenseTypeLabel, paidForLabel, type ExpenseRow, expenseStatusBadge } from "@/lib/domain/expenses";
import { routes } from "@/lib/domain/routes";
import { ExpenseRowMenu } from "./expense-row-menu";

const COLUMNS: readonly LedgerColumn<ExpenseRow>[] = [
  numberColumn((e) => e.expenseNumber),
  { header: "Date", className: "whitespace-nowrap tabular", cell: (e) => formatDisplayDate(e.expenseDate) },
  {
    header: "Type",
    cell: (e) => (
      <Link
        href={routes.expenses.page(e.expenseId)}
        className="font-medium whitespace-nowrap text-foreground underline-offset-4 group-hover:underline"
      >
        {expenseTypeLabel(e.expenseType)}
      </Link>
    ),
  },
  {
    header: "Paid for",
    className: "max-w-56",
    cell: (e) => <span className="block truncate">{paidForLabel(e.expenseType, e.paidFor)}</span>,
  },
  { header: "Kind", cell: (e) => <StatusBadge value={e.expenseKind} /> },
  { header: "Status", cell: (e) => <StatusBadge value={expenseStatusBadge(e.status)} /> },
  amountColumn("Amount", (e) => <Money amount={e.amount} />, { strong: true }),
  actionsColumn((e) => <ExpenseRowMenu expense={expenseActionTargetOf(e)} />),
];

/**
 * `expenses` is the page shown; `totals` cover every expense that matches the
 * filters, across all pages (worked out by the database).
 */
export function ExpenseTable({
  expenses,
  totals,
  archived = false,
}: {
  expenses: ExpenseRow[];
  totals: { count: number; total: number };
  /** The archived view: the totals cover the archived expenses shown. */
  archived?: boolean;
}) {
  return (
    <LedgerTableFrame
      rows={expenses}
      rowKey={(e) => e.expenseId}
      columns={COLUMNS}
      muted={(e) => e.status !== "Active"}
      footer={
        <>
          <TotalsLabelCell colSpan={6}>
            {archived ? `${totals.count} archived` : `${totals.count} active of ${totals.count} matching`}
          </TotalsLabelCell>
          <TotalCell strong>
            <Money amount={totals.total} />
          </TotalCell>
          <TableCell />
        </>
      }
      card={(e) => (
        <>
          <CardHeader
            eyebrow={`No. ${e.expenseNumber}`}
            title={expenseTypeLabel(e.expenseType)}
            href={routes.expenses.page(e.expenseId)}
            lines={
              <CardLine>
                {paidForLabel(e.expenseType, e.paidFor)} · {formatDisplayDate(e.expenseDate)}
              </CardLine>
            }
            menu={<ExpenseRowMenu expense={expenseActionTargetOf(e)} />}
          />
          <CardFigures items={[{ label: "Amount", value: <Money amount={e.amount} />, strong: true }]} />
          <CardMeta
            items={[
              { label: "Kind", value: <StatusBadge value={e.expenseKind} /> },
              { label: "Status", value: <StatusBadge value={expenseStatusBadge(e.status)} /> },
            ]}
          />
        </>
      )}
    />
  );
}
