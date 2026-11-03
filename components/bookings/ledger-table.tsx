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
import { refundStatusOf } from "@/lib/domain/refunds";
import { actionTargetOf, type LedgerRow } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { BookingRowMenu } from "./booking-row-menu";

/** Its payment status; a cancelled booking's refund instead, with the amount. */
function PaymentCell({ booking }: { booking: LedgerRow }) {
  const refund = refundStatusOf(booking);
  if (!refund) return <StatusBadge value={booking.paymentStatus} />;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap md:flex-col md:items-start md:gap-0.5">
      <StatusBadge value={refund} />
      <Money amount={booking.refundAmount} className="text-xs" />
    </span>
  );
}

/** A cancelled trip owes nothing. */
const Balance = ({ booking }: { booking: LedgerRow }) => (booking.bookingStatus === "Cancelled" ? "—" : <Money amount={booking.balanceAmount} />);

/** Customer and Trip share the room the other columns leave, down to a readable minimum; longer text is cut short. */
const FLEXIBLE = { className: "w-1/4 max-w-0", headerClassName: "min-w-28" };
const FLEXIBLE_TEXT = "block truncate";

const COLUMNS: readonly LedgerColumn<LedgerRow>[] = [
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
  amountColumn("Total", (b) => <Money amount={b.totalAmount} />),
  amountColumn("Received", (b) => <Money amount={b.amountPaid} />),
  amountColumn("Balance", (b) => <Balance booking={b} />, { strong: true }),
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
}: {
  bookings: LedgerRow[];
  totals: LedgerTotals;
  /** The archived view: totals cover the archived bookings shown. */
  archived?: boolean;
}) {
  // Otherwise, like the summary figures, totals count active bookings only
  const totals = archived
    ? { total: all.total, received: all.received, balance: all.balance }
    : { total: all.activeTotal, received: all.activeReceived, balance: all.activeBalance };

  return (
    <LedgerTableFrame
      rows={bookings}
      rowKey={(b) => b.bookingId}
      columns={COLUMNS}
      muted={(b) => b.bookingStatus !== "Active"}
      dense
      footer={
        <>
          <TotalsLabelCell colSpan={5}>{archived ? `${all.count} archived` : `${all.activeCount} active of ${all.count} matching · received after refunds`}</TotalsLabelCell>
          <TotalCell>
            <Money amount={totals.total} />
          </TotalCell>
          <TotalCell>
            <Money amount={totals.received} />
          </TotalCell>
          <TotalCell strong>
            <Money amount={totals.balance} />
          </TotalCell>
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
              { label: "Total", value: <Money amount={b.totalAmount} /> },
              { label: "Received", value: <Money amount={b.amountPaid} /> },
              { label: "Balance", value: <Balance booking={b} />, strong: true },
            ]}
          />
          <CardMeta
            items={[
              { label: "Payment", value: <PaymentCell booking={b} /> },
              { label: "Trip", value: <StatusBadge value={b.bookingStatus} /> },
              { label: "Closed by", value: <span className="text-foreground">{b.closedBy?.label ?? "—"}</span> },
            ]}
          />
        </>
      )}
    />
  );
}
