// components/bookings/booking-cancellation.tsx
// A cancelled booking's page: when it was cancelled, what came in, what goes back
// and what's kept; and marking the refund paid (a checkbox and its date).

"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formFields } from "@/components/forms/fields";
import { RecordDialog } from "@/components/settings/record-dialog";
import { DatePicker } from "@/components/shared/date-picker";
import { MetaItem } from "@/components/shared/meta-item";
import { Money } from "@/components/shared/money";
import { RecordDocument } from "@/components/shared/record-document";
import { StatusBadge } from "@/components/shared/status-badge";
import { TitledSection } from "@/components/shared/titled-section";
import { formatDisplayDate, todayIST } from "@/lib/domain/dates";
import { keptAmount, refundStatusOf } from "@/lib/domain/refunds";
import { routes } from "@/lib/domain/routes";
import type { Booking } from "@/lib/domain/types";
import { useRecordActions } from "@/hooks/use-record-actions";
import { refundFormSchema } from "./cancel-booking-dialog";

type RefundValues = { refundAmount: number };
const { NumberField } = formFields<RefundValues>();

type CancelledBooking = Pick<Booking, "bookingId" | "invoiceNumber" | "updatedAt" | "bookingStatus" | "amountPaid" | "cancelledOn" | "refundAmount" | "refundedOn">;

export function BookingCancellation({ booking }: { booking: CancelledBooking }) {
  const url = routes.api.bookings.one(booking.bookingId);
  const { run, pending } = useRecordActions({ url, version: booking.updatedAt, title: `Booking No. ${booking.invoiceNumber}` });
  const [editing, setEditing] = useState(false);
  const schema = useMemo(() => refundFormSchema(booking.amountPaid), [booking.amountPaid]);
  const status = refundStatusOf(booking);
  const today = todayIST();
  const markPaid = (refundedOn: string | null) => run({ method: "PATCH", body: { refundedOn } }, refundedOn ? "Refund marked paid" : "Refund marked not paid");

  return (
    <TitledSection id="cancellation" title="Cancellation" description="What came in, what goes back, and what the business keeps." className="mt-10">
      <RecordDocument
        bandClassName="sm:grid-cols-4"
        band={
          <>
            <MetaItem label="Cancelled on" value={booking.cancelledOn ? formatDisplayDate(booking.cancelledOn) : "Not recorded"} />
            <MetaItem label="Received" value={<Money amount={booking.amountPaid} />} />
            <MetaItem label="Refund" value={<Money amount={booking.refundAmount} />} />
            <MetaItem label="Kept" value={<Money amount={keptAmount(booking)} />} />
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4 text-sm">
          {status ? (
            <>
              <StatusBadge value={status} />
              <label className="flex items-center gap-2 font-medium">
                <Checkbox checked={Boolean(booking.refundedOn)} disabled={pending} onCheckedChange={(checked) => void markPaid(checked ? today : null)} />
                Refund paid
              </label>
              {booking.refundedOn && (
                <DatePicker
                  label="Refund date"
                  value={booking.refundedOn}
                  min={booking.cancelledOn ?? undefined}
                  max={today}
                  onChange={(day) => void markPaid(day)}
                  className="h-9 w-44 flex-none text-sm"
                />
              )}
            </>
          ) : (
            <span className="text-muted-foreground">No refund on this booking.</span>
          )}
          {!booking.refundedOn && (
            <Button variant="outline" size="lg" className="ml-auto" disabled={pending} onClick={() => setEditing(true)}>
              <Pencil />
              Change amount
            </Button>
          )}
          {booking.refundedOn && <span className="ml-auto text-xs text-muted-foreground">To reactivate this booking or change the amount, untick Refund paid first.</span>}
        </div>
      </RecordDocument>

      <RecordDialog<RefundValues>
        open={editing}
        onOpenChange={setEditing}
        title="Change the refund"
        description="Up to what was received. What's kept changes with it."
        schema={schema}
        defaultValues={{ refundAmount: booking.refundAmount }}
        target={{ mode: "edit", url, version: booking.updatedAt }}
        saved="Refund changed"
      >
        <NumberField name="refundAmount" label="Refund amount" required />
      </RecordDialog>
    </TitledSection>
  );
}
