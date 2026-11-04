// components/bookings/booking-history.tsx
// The booking page's history, in the shared table frame: a row for each tracked
// change (lib/domain/booking-history.ts), newest first, with the figures and
// the bill of that moment; the totals row is the booking as it stands now.
// Archived bookings have no bills. An "Estimated" row is from before history was kept.

import { TableCell } from "@/components/ui/table";
import { amountColumn, CardFigures, CardHeader, CardLine, LedgerTableFrame, TotalCell, TotalsLabelCell, type LedgerColumn } from "@/components/shared/ledger-table-frame";
import { Money } from "@/components/shared/money";
import { RecordList } from "@/components/shared/record-list";
import { TitledSection } from "@/components/shared/titled-section";
import type { HistoryRow } from "@/lib/domain/booking-history";
import { formatDisplayDate } from "@/lib/domain/dates";
import type { PageInfo } from "@/lib/domain/filters";
import { isArchived } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import type { Booking } from "@/lib/domain/types";
import { HistoryBillActions } from "./history-bill-actions";

const Change = ({ row }: { row: HistoryRow }) => (
  <>
    {row.change}
    {row.rebuilt && (
      <span title="From before history was kept: the amount received then, with the booking's other details as last saved." className="ml-2 text-xs font-normal text-muted-foreground">
        Estimated
      </span>
    )}
  </>
);

/** The money the row added; a change with none shows a dash. */
const Payment = ({ row }: { row: HistoryRow }) => (row.payment === 0 ? "—" : <Money amount={row.payment} />);

/** A cancelled trip owes nothing. */
const Balance = ({ amount }: { amount: number | null }) => (amount === null ? "—" : <Money amount={amount} />);

type HistoryBooking = Pick<Booking, "bookingId" | "invoiceNumber" | "bookingStatus" | "travellers" | "totalAmount" | "amountPaid" | "balanceAmount" | "refundAmount" | "refundedOn">;

export function BookingHistory({ booking, history }: { booking: HistoryBooking; history: { items: readonly HistoryRow[] } & PageInfo }) {
  const billCell = (row: HistoryRow) =>
    isArchived(booking) ? null : <HistoryBillActions booking={booking} entryId={row.entryId} day={formatDisplayDate(row.changedOn)} />;

  const columns: readonly LedgerColumn<HistoryRow>[] = [
    { header: "Date", className: "whitespace-nowrap tabular", cell: (row) => formatDisplayDate(row.changedOn) },
    { header: "Change", className: "font-medium whitespace-normal", cell: (row) => <Change row={row} /> },
    amountColumn("Pax", (row) => row.travellers, { className: "tabular" }),
    amountColumn("Total", (row) => <Money amount={row.totalAmount} />),
    amountColumn("Payment", (row) => <Payment row={row} />),
    amountColumn("Received", (row) => <Money amount={row.received} />),
    amountColumn("Balance", (row) => <Balance amount={row.balance} />, { strong: true }),
    { header: "Bill", headerClassName: "w-24 text-right", className: "text-right", cell: billCell },
  ];

  return (
    <TitledSection
      id="history"
      title="Booking history"
      description="Every change to the people, price, slot amount or amount received, and every cancellation, refund and archive, with the bill as it stood then."
    >
      <RecordList
        table={
          <LedgerTableFrame
            rows={history.items}
            rowKey={(row) => row.entryId}
            columns={columns}
            footer={
              <>
                {/* The booking as it stands, not a sum */}
                <TotalsLabelCell colSpan={2} label="Now" />
                <TotalCell>
                  <span className="tabular">{booking.travellers}</span>
                </TotalCell>
                <TotalCell>
                  <Money amount={booking.totalAmount} />
                </TotalCell>
                {/* Like a row that adds no money */}
                <TotalCell>—</TotalCell>
                <TotalCell>
                  <Money amount={booking.amountPaid - (booking.refundedOn ? booking.refundAmount : 0)} />
                </TotalCell>
                <TotalCell strong>
                  <Balance amount={booking.bookingStatus === "Cancelled" ? null : booking.balanceAmount} />
                </TotalCell>
                <TableCell />
              </>
            }
            card={(row) => (
              <>
                <CardHeader title={<Change row={row} />} lines={<CardLine>{formatDisplayDate(row.changedOn)}</CardLine>} menu={billCell(row)} />
                <CardFigures
                  items={[
                    { label: "Pax", value: <span className="tabular">{row.travellers}</span> },
                    { label: "Total", value: <Money amount={row.totalAmount} /> },
                    { label: "Payment", value: <Payment row={row} /> },
                    { label: "Received", value: <Money amount={row.received} /> },
                    { label: "Balance", value: <Balance amount={row.balance} />, strong: true },
                  ]}
                  columns={3}
                />
              </>
            )}
          />
        }
        noMatches={<p className="text-sm text-muted-foreground">History not recorded yet.</p>}
        page={history}
        links={{ path: routes.bookings.page(booking.bookingId), params: {}, pageParam: "historyPage", anchor: "history" }}
        label="Booking history pages"
      />
    </TitledSection>
  );
}
