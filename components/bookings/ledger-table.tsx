// components/bookings/ledger-table.tsx
// The bookings ledger: a table on desktop (with a totals footer, like the foot
// of a ledger page) and stacked cards on small screens.

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDisplayDate } from "@/lib/domain/dates";
import type { LedgerTotals } from "@/lib/domain/summary";
import { actionTargetOf, type LedgerRow } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { BookingRowMenu } from "./booking-row-menu";

const inactive = (b: LedgerRow) => b.bookingStatus !== "Active";

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
    <>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="eyebrow h-10 w-36 pl-5 text-muted-foreground">No.</TableHead>
              <TableHead className="eyebrow text-muted-foreground">Customer</TableHead>
              <TableHead className="eyebrow text-muted-foreground">Trip</TableHead>
              <TableHead className="eyebrow text-muted-foreground">Starts</TableHead>
              <TableHead className="eyebrow text-right text-muted-foreground">Pax</TableHead>
              <TableHead className="eyebrow text-right text-muted-foreground">Total</TableHead>
              <TableHead className="eyebrow text-right text-muted-foreground">Received</TableHead>
              <TableHead className="eyebrow text-right text-muted-foreground">Balance</TableHead>
              <TableHead className="eyebrow text-muted-foreground">Payment</TableHead>
              <TableHead className="eyebrow text-muted-foreground">Trip</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.bookingId} className={cn("group", inactive(b) && "text-muted-foreground")}>
                <TableCell className="pl-5 font-heading text-base tabular">{b.invoiceNumber}</TableCell>
                <TableCell className="max-w-48">
                  <Link
                    href={`/bookings/${b.bookingId}`}
                    className="block truncate font-medium text-foreground underline-offset-4 group-hover:underline"
                  >
                    {b.customerName}
                  </Link>
                  <span className="text-xs text-muted-foreground tabular">{b.customerPhone}</span>
                </TableCell>
                <TableCell className="max-w-64">
                  <span className="block truncate">{b.packageName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {b.destination} · {b.batchName}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular">{formatDisplayDate(b.tripStartDate)}</TableCell>
                <TableCell className="text-right tabular">{b.travellers}</TableCell>
                <TableCell className="text-right">
                  <Money amount={b.totalAmount} />
                </TableCell>
                <TableCell className="text-right">
                  <Money amount={b.amountPaid} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  <Money amount={b.balanceAmount} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={b.paymentStatus} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={b.bookingStatus} />
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <BookingRowMenu booking={actionTargetOf(b)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="border-t-0 bg-transparent">
            <TableRow className="border-t-[3px] border-double border-t-rule hover:bg-transparent">
              <TableCell colSpan={5} className="pl-5 text-muted-foreground">
                <span className="eyebrow">Totals</span>
                <span className="ml-2 text-xs">
                  {archived ? `${all.count} archived` : `${all.activeCount} active of ${all.count} matching`}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium">
                <Money amount={totals.total} />
              </TableCell>
              <TableCell className="text-right font-medium">
                <Money amount={totals.received} />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <Money amount={totals.balance} />
              </TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 md:hidden">
        {bookings.map((b) => (
          <li key={b.bookingId} className={cn("rounded-xl border bg-card p-4", inactive(b) && "opacity-75")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow text-muted-foreground">No. {b.invoiceNumber}</p>
                <Link href={`/bookings/${b.bookingId}`} className="mt-1 block truncate font-medium">
                  {b.customerName}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  {b.packageName} · {formatDisplayDate(b.tripStartDate)}
                </p>
              </div>
              <BookingRowMenu booking={actionTargetOf(b)} />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd>
                  <Money amount={b.totalAmount} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Received</dt>
                <dd>
                  <Money amount={b.amountPaid} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Balance</dt>
                <dd className="font-medium">
                  <Money amount={b.balanceAmount} />
                </dd>
              </div>
            </dl>
            <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <dt>Payment</dt>
                <dd>
                  <StatusBadge status={b.paymentStatus} />
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt>Trip</dt>
                <dd>
                  <StatusBadge status={b.bookingStatus} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
