// components/bookings/booking-document.tsx
// A saved booking laid out like its Bill of Supply: invoice band, bill-to,
// the service line, subtotal, totals and note. Internal notes are shown
// separately because they are never printed.

import { Lock, Mail } from "lucide-react";
import { Money } from "@/components/shared/money";
import { discountPercentLabel, quantityLabel, serviceDescription } from "@/lib/domain/bill-text";
import { formatDisplayDate } from "@/lib/domain/dates";
import { amountToWords } from "@/lib/domain/words";
import type { Booking } from "@/lib/domain/types";

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular">{value}</dd>
    </div>
  );
}

const th = "eyebrow px-3 py-2.5 text-left font-semibold text-muted-foreground";
const td = "px-3 py-3 align-top";

export function BookingDocument({ booking: b }: { booking: Booking }) {
  return (
    <div className="space-y-6">
      <article className="overflow-hidden rounded-xl border bg-card">
        {/* Invoice band — the grey strip at the top of the bill */}
        <dl className="grid grid-cols-2 gap-4 bg-muted/60 px-6 py-4 sm:grid-cols-4">
          <Meta label="Invoice No." value={b.invoiceNumber} />
          <Meta label="Invoice date" value={b.invoiceDate} />
          <Meta label="Due date" value={b.dueDate} />
          <Meta label="Destination" value={b.destination} />
        </dl>

        {/* Bill to + trip */}
        <div className="grid gap-6 px-6 py-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow text-muted-foreground">Bill to</p>
            <p className="mt-2 font-heading text-2xl font-medium">{b.customerName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Mobile: <span className="tabular text-foreground">{b.customerPhone}</span>
            </p>
          </div>
          <div className="sm:text-right">
            <p className="eyebrow text-muted-foreground">Trip</p>
            <p className="mt-2 font-medium tabular">
              {formatDisplayDate(b.tripStartDate)} – {formatDisplayDate(b.tripEndDate)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{b.batchName}</p>
          </div>
        </div>

        {/* Service line — stacked on phones */}
        <div className="border-y-2 border-foreground/80 px-6 py-4 sm:hidden">
          <p className="eyebrow text-muted-foreground">Services</p>
          <p className="mt-2 font-medium uppercase">{b.packageName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{serviceDescription(b)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Batch</dt>
              <dd className="uppercase">{b.batchName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Qty.</dt>
              <dd className="tabular">{quantityLabel(b.travellers)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rate</dt>
              <dd>
                <Money amount={b.ratePerPerson} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Discount</dt>
              <dd>
                <Money amount={b.discountAmount} />{" "}
                <span className="text-xs text-muted-foreground tabular">{discountPercentLabel(b.discountPercentage)}</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Service table */}
        <div className="hidden overflow-x-auto px-3 pb-2 sm:block">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-y-2 border-foreground/80">
              <tr>
                <th className={th}>Services</th>
                <th className={th}>Batch</th>
                <th className={`${th} text-right`}>Qty.</th>
                <th className={`${th} text-right`}>Rate</th>
                <th className={`${th} text-right`}>Disc.</th>
                <th className={`${th} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>
                  <p className="font-medium uppercase">{b.packageName}</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">{serviceDescription(b)}</p>
                </td>
                <td className={`${td} uppercase`}>{b.batchName}</td>
                <td className={`${td} text-right tabular whitespace-nowrap`}>{quantityLabel(b.travellers)}</td>
                <td className={`${td} text-right`}>
                  <Money amount={b.ratePerPerson} showSymbol={false} />
                </td>
                <td className={`${td} text-right`}>
                  <Money amount={b.discountAmount} showSymbol={false} />
                  <span className="block text-xs text-muted-foreground tabular">
                    {discountPercentLabel(b.discountPercentage)}
                  </span>
                </td>
                <td className={`${td} text-right font-medium`}>
                  <Money amount={b.totalAmount} showSymbol={false} />
                </td>
              </tr>
            </tbody>
            <tfoot className="border-y-2 border-foreground/80 font-semibold">
              <tr>
                <td className={`${td} eyebrow py-2.5`} colSpan={2}>
                  Subtotal
                </td>
                <td className={`${td} py-2.5 text-right tabular`}>{b.travellers}</td>
                <td className={td} />
                <td className={`${td} py-2.5 text-right`}>
                  <Money amount={b.discountAmount} />
                </td>
                <td className={`${td} py-2.5 text-right`}>
                  <Money amount={b.totalAmount} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes + totals */}
        <div className="grid gap-8 px-6 pt-4 pb-6 sm:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <p className="eyebrow text-muted-foreground">Notes</p>
            <p className="mt-2 text-sm whitespace-pre-line">
              {b.invoiceNote || <span className="text-muted-foreground italic">No note on this bill.</span>}
            </p>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="font-semibold">Total Amount</dt>
              <dd className="font-heading text-xl font-medium">
                <Money amount={b.totalAmount} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Received Amount</dt>
              <dd>
                <Money amount={b.amountPaid} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="font-semibold">Balance</dt>
              <dd className="font-semibold">
                <Money amount={b.balanceAmount} />
              </dd>
            </div>
            <div className="pt-3 text-right">
              <dt className="eyebrow text-muted-foreground">Total amount (in words)</dt>
              <dd className="mt-1 font-heading italic">{amountToWords(b.totalAmount)}</dd>
            </div>
          </dl>
        </div>
      </article>

      {/* Contact details kept off the bill */}
      <section className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-rule bg-muted/40 px-6 py-3 text-sm">
        <span className="eyebrow flex items-center gap-1.5 text-muted-foreground">
          <Mail className="size-3" aria-hidden />
          Customer email — not printed
        </span>
        {b.customerEmail ? (
          <a href={`mailto:${b.customerEmail}`} className="break-all underline-offset-4 hover:underline">
            {b.customerEmail}
          </a>
        ) : (
          <span className="text-muted-foreground">No email</span>
        )}
      </section>

      {b.internalNotes && (
        <section className="rounded-xl border border-dashed border-rule bg-muted/40 px-6 py-4">
          <p className="eyebrow flex items-center gap-1.5 text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Internal note — not printed
          </p>
          <p className="mt-2 text-sm whitespace-pre-line">{b.internalNotes}</p>
        </section>
      )}
    </div>
  );
}
