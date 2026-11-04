// components/bookings/booking-document.tsx
// A saved booking laid out like its Bill of Supply (RecordDocument): invoice
// band, bill-to, the service line, subtotal, totals and note. Who closed it and
// the internal note are shown separately because they are never printed. Sits in a PageGroup.

import { Lock } from "lucide-react";
import { CardFigures } from "@/components/shared/ledger-table-frame";
import { MetaItem } from "@/components/shared/meta-item";
import { Money } from "@/components/shared/money";
import { RECORD_PANEL, RECORD_PARTIES } from "@/components/shared/layout-classes";
import { DocumentTotal, FigureRow, LabeledBlock, NotesAndFigures, PartyBlock, RecordDocument } from "@/components/shared/record-document";
import { billWords, CANCELLATION_CHARGE_LABEL, discountPercentLabel, NO_NOTE, packageTypeLabel, quantityLabel, refundLabel, serviceDescription } from "@/lib/domain/bill-text";
import { formatDisplayDate } from "@/lib/domain/dates";
import { cancellationOf, keptAmount } from "@/lib/domain/refunds";
import type { Booking } from "@/lib/domain/types";
import { CancelledSeal } from "./cancelled-seal";

const th = "eyebrow px-3 py-2.5 text-left font-semibold text-muted-foreground";
const td = "px-3 py-3 align-top";
const lock = <Lock className="size-3" aria-hidden />;

export function BookingDocument({ booking: b }: { booking: Booking }) {
  const cancellation = cancellationOf(b);
  const typeLabel = packageTypeLabel(b.packageType);
  return (
    <>
      {/* The band is the grey strip at the top of the bill */}
      <RecordDocument
        bandClassName="sm:grid-cols-4"
        band={
          <>
            <MetaItem label="Invoice No." value={b.invoiceNumber} />
            <MetaItem label="Invoice date" value={b.invoiceDate} />
            <MetaItem label="Due date" value={b.dueDate} />
            <MetaItem label="Destination" value={b.destination} />
          </>
        }
      >
        {/* Bill to + trip */}
        <div className={RECORD_PARTIES}>
          <PartyBlock label="Bill to" name={b.customerName}>
            Mobile: <span className="tabular text-foreground">{b.customerPhone}</span>
          </PartyBlock>
          <LabeledBlock label="Trip" className="sm:text-right">
            <div className="space-y-1">
              <p className="font-medium tabular">
                {formatDisplayDate(b.tripStartDate)} – {formatDisplayDate(b.tripEndDate)}
              </p>
              <p className="text-sm text-muted-foreground">{b.batchName}</p>
            </div>
          </LabeledBlock>
        </div>

        {/* Service line — stacked on phones */}
        <LabeledBlock label="Services" className="border-y-2 border-foreground/80 px-6 py-4 sm:hidden">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="font-medium uppercase">{b.packageName}</p>
              {typeLabel && <p className="text-xs text-muted-foreground">{typeLabel}</p>}
              <p className="text-xs text-muted-foreground">{serviceDescription(b)}</p>
            </div>
            <CardFigures
              columns={2}
              className="gap-x-4 gap-y-3 border-t-0 pt-0"
              items={[
                { label: "Batch", value: <span className="uppercase">{b.batchName}</span> },
                { label: "Qty.", value: <span className="tabular">{quantityLabel(b.travellers)}</span> },
                { label: "Rate", value: <Money amount={b.ratePerPerson} /> },
                {
                  label: "Discount",
                  value: (
                    <>
                      <Money amount={b.discountAmount} />{" "}
                      <span className="text-xs text-muted-foreground tabular">{discountPercentLabel(b.discountPercentage)}</span>
                    </>
                  ),
                },
              ]}
            />
          </div>
        </LabeledBlock>

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
                <td className={`${td} space-y-1`}>
                  <p className="font-medium uppercase">{b.packageName}</p>
                  {typeLabel && <p className="text-xs text-muted-foreground">{typeLabel}</p>}
                  <p className="max-w-sm text-xs text-muted-foreground">{serviceDescription(b)}</p>
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

        <NotesAndFigures note={b.invoiceNote} noNote={NO_NOTE} words={billWords(b.totalAmount, cancellation)} seal={cancellation && <CancelledSeal cancellation={cancellation} />}>
          <DocumentTotal label="Total Amount" amount={b.totalAmount} />
          <FigureRow label="Received Amount" labelClassName="text-muted-foreground">
            <Money amount={b.amountPaid} />
          </FigureRow>
          {cancellation ? (
            <>
              <FigureRow label={CANCELLATION_CHARGE_LABEL} labelClassName="text-muted-foreground">
                <Money amount={keptAmount(b)} />
              </FigureRow>
              <FigureRow label={refundLabel(cancellation)} labelClassName="font-semibold" valueClassName="font-semibold">
                <Money amount={b.refundAmount} />
              </FigureRow>
            </>
          ) : (
            <FigureRow label="Balance" labelClassName="font-semibold" valueClassName="font-semibold">
              <Money amount={b.balanceAmount} />
            </FigureRow>
          )}
        </NotesAndFigures>
      </RecordDocument>

      <div className={RECORD_PANEL}>
        <LabeledBlock label="Lead closed by" icon={lock}>
          <p className="text-sm break-words">{b.closedBy?.label ?? <span className="text-muted-foreground italic">Not recorded</span>}</p>
        </LabeledBlock>
        {b.internalNotes && (
          <LabeledBlock label="Internal note" icon={lock} className="border-t border-rule pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
            <p className="text-sm whitespace-pre-line">{b.internalNotes}</p>
          </LabeledBlock>
        )}
      </div>
    </>
  );
}
