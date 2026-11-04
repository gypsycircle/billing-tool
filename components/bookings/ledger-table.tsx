// components/bookings/ledger-table.tsx
// The bookings ledger: its columns, totals and cards, in the shared table frame.

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
import { routes } from "@/lib/domain/routes";
import type { LedgerTotals } from "@/lib/domain/summary";
import { keptAmount, paymentBadgeOf } from "@/lib/domain/refunds";
import type { BookingFilters, TripStatus } from "@/lib/domain/filters";
import { actionTargetOf, type LedgerRow } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { BookingRowMenu } from "./booking-row-menu";

const PaymentCell = ({ booking }: { booking: LedgerRow }) => <StatusBadge value={paymentBadgeOf(booking)} />;

/** One money column: its heading, a row's figure, and its total over every match. */
interface Figure {
  label: string;
  cell: (booking: LedgerRow) => React.ReactNode;
  total: (totals: LedgerTotals) => number;
  strong?: boolean;
  /** A phone card's label, when it differs by booking. */
  cardLabel?: (booking: LedgerRow) => string;
}

const TOTAL = { label: "Total", cell: (b: LedgerRow) => <Money amount={b.totalAmount} /> };
const RECEIVED = { label: "Received", cell: (b: LedgerRow) => <Money amount={b.amountPaid} /> };
const BALANCE = { label: "Balance", cell: (b: LedgerRow) => <Money amount={b.balanceAmount} />, strong: true };
/**
 * The three money columns. Active: what's still owed. Cancelled: where the money
 * went, so each column adds up its own rows. Archived: their own figures.
 */
function figuresFor(status: TripStatus, archived: boolean, payment?: BookingFilters["payment"]): readonly Figure[] {
  if (archived) {
    return [
      { ...TOTAL, total: (t) => t.total },
      { ...RECEIVED, total: (t) => t.received },
      { ...BALANCE, total: (t) => t.balance },
    ];
  }
  if (status === "Cancelled") {
    return [
      { ...RECEIVED, total: (t) => t.received },
      { label: "Kept", cell: (b) => <Money amount={keptAmount(b)} />, total: (t) => t.activeReceived },
      {
        // One heading has to cover every row: Refunded only when the filter leaves paid ones alone. The Payment badge tells them apart.
        label: payment === "Refunded" ? "Refunded" : "Refund",
        cardLabel: (b) => (b.refundedOn ? "Refunded" : "Refund"),
        cell: (b) => <Money amount={b.refundAmount} />,
        total: (t) => t.refundTotal,
        strong: true,
      },
    ];
  }
  return [
    { ...TOTAL, total: (t) => t.activeTotal },
    { ...RECEIVED, total: (t) => t.activeReceived },
    { ...BALANCE, total: (t) => t.activeBalance },
  ];
}

/** Customer and Trip share the room the other columns leave, down to a readable minimum; longer text is cut short. */
const FLEXIBLE = { className: "w-1/4 max-w-0", headerClassName: "min-w-24" };
const FLEXIBLE_TEXT = "block truncate";

const columnsFor = (figures: readonly Figure[]): readonly LedgerColumn<LedgerRow>[] => [
  numberColumn((b) => b.invoiceNumber),
  {
    header: "Customer",
    ...FLEXIBLE,
    cell: (b) => (
      <>
        <Link
          href={routes.bookings.page(b.bookingId)}
          className={cn(FLEXIBLE_TEXT, "font-medium text-foreground underline-offset-4 group-hover:underline")}
        >
          {b.customerName}
        </Link>
        <span className="text-xs text-muted-foreground tabular">{b.customerPhone}</span>
      </>
    ),
  },
  {
    header: "Trip",
    ...FLEXIBLE,
    cell: (b) => (
      <>
        <span className={FLEXIBLE_TEXT}>{b.packageName}</span>
        <span className={cn(FLEXIBLE_TEXT, "text-xs text-muted-foreground")}>
          {b.destination} · {b.batchName}
        </span>
      </>
    ),
  },
  { header: "Starts", className: "whitespace-nowrap tabular", cell: (b) => formatDisplayDate(b.tripStartDate) },
  amountColumn("Pax", (b) => b.travellers, { className: "tabular" }),
  ...figures.map(({ label, cell, strong }) => amountColumn(label, cell, { strong })),
  { header: "Payment", cell: (b) => <PaymentCell booking={b} /> },
  { header: "Trip", cell: (b) => <StatusBadge value={b.bookingStatus} /> },
  { header: "Closed by", className: "max-w-20 truncate", cell: (b) => <span title={b.closedBy?.label}>{b.closedBy?.label ?? "—"}</span> },
  actionsColumn((b) => <BookingRowMenu booking={actionTargetOf(b)} />),
];

/**
 * `bookings` is the page shown; `totals` cover every booking that matches the
 * filters, across all pages (worked out by the database).
 */
export function LedgerTable({
  bookings,
  totals: all,
  archived = false,
  status,
  payment,
}: {
  bookings: LedgerRow[];
  totals: LedgerTotals;
  /** The archived view: totals cover the archived bookings shown. */
  archived?: boolean;
  /** The Trip status filter's choice: which bookings these are, and so which money columns. */
  status: TripStatus;
  /** The Payment filter's choice, which sets the Refund column's heading. */
  payment?: BookingFilters["payment"];
}) {
  const figures = figuresFor(status, archived, payment);

  return (
    <LedgerTableFrame
      rows={bookings}
      rowKey={(b) => b.bookingId}
      columns={columnsFor(figures)}
      footer={
        <>
          <TotalsLabelCell colSpan={5}>{`${all.count} ${archived ? "archived" : status.toLowerCase()}`}</TotalsLabelCell>
          {figures.map(({ label, total, strong }) => (
            <TotalCell key={label} strong={strong}>
              <Money amount={total(all)} />
            </TotalCell>
          ))}
          <TableCell colSpan={4} />
        </>
      }
      card={(b) => (
        <>
          <CardHeader
            eyebrow={`No. ${b.invoiceNumber}`}
            title={b.customerName}
            href={routes.bookings.page(b.bookingId)}
            lines={
              <CardLine>
                {b.packageName} · {formatDisplayDate(b.tripStartDate)}
              </CardLine>
            }
            menu={<BookingRowMenu booking={actionTargetOf(b)} />}
          />
          <CardFigures
            columns={4}
            items={[
              { label: "Pax", value: <span className="tabular">{b.travellers}</span> },
              ...figures.map(({ label, cardLabel, cell, strong }) => ({ label: cardLabel?.(b) ?? label, value: cell(b), strong })),
            ]}
          />
          <CardMeta
            items={[
              { label: "Payment", value: <PaymentCell booking={b} /> },
              { label: "Trip", value: <StatusBadge value={b.bookingStatus} /> },
              { label: "Lead closed by", value: <span className="text-foreground">{b.closedBy?.label ?? "—"}</span> },
            ]}
          />
        </>
      )}
    />
  );
}
