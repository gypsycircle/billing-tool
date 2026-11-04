// components/bookings/booking-cancellation.tsx
// A cancelled booking's page: when it was cancelled, what came in, what goes back
// and what's kept; and marking the refund paid (a checkbox that asks first, and when it was).

"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formFields } from "@/components/forms/fields";
import { RecordDialog } from "@/components/settings/record-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MetaItem } from "@/components/shared/meta-item";
import { Money } from "@/components/shared/money";
import { RecordDocument } from "@/components/shared/record-document";
import { StatusBadge } from "@/components/shared/status-badge";
import { TitledSection } from "@/components/shared/titled-section";
import { formatDisplayDate, formatTimestampIST } from "@/lib/domain/dates";
import { formatAmount } from "@/lib/domain/money";
import { keptAmount, refundStatusOf } from "@/lib/domain/refunds";
import { routes } from "@/lib/domain/routes";
import type { Booking } from "@/lib/domain/types";
import { useRecordActions } from "@/hooks/use-record-actions";
import { refundFormSchema } from "./cancel-booking-dialog";

type RefundValues = { refundAmount: number };
const { NumberField } = formFields<RefundValues>();

type CancelledBooking = Pick<Booking, "bookingId" | "invoiceNumber" | "updatedAt" | "bookingStatus" | "amountPaid" | "cancelledOn" | "refundAmount" | "refundedOn" | "refundedAt">;

export function BookingCancellation({ booking }: { booking: CancelledBooking }) {
  const url = routes.api.bookings.one(booking.bookingId);
  const { run, pending } = useRecordActions({ url, version: booking.updatedAt, title: `Booking No. ${booking.invoiceNumber}` });
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const paid = Boolean(booking.refundedOn);
  const schema = useMemo(() => refundFormSchema(booking.amountPaid), [booking.amountPaid]);
  const status = refundStatusOf(booking) ?? "No refund";
  const setPaid = () => run({ method: "PATCH", body: { refundPaid: !paid } }, paid ? "Refund marked not paid." : "Refund marked paid.");

  return (
    <TitledSection id="cancellation" title="Cancellation" description="What came in, what goes back, and what the business keeps.">
      <RecordDocument
        bandClassName="sm:grid-cols-4"
        band={
          <>
            <MetaItem label="Cancelled on" value={booking.cancelledOn ? formatDisplayDate(booking.cancelledOn) : "Not recorded"} />
            <MetaItem label="Received" value={<Money amount={booking.amountPaid} />} />
            <MetaItem label="Kept" value={<Money amount={keptAmount(booking)} />} />
            <MetaItem label="Refund" value={<Money amount={booking.refundAmount} />} />
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-4 text-sm">
          <StatusBadge value={status} />
          {booking.refundAmount > 0 && (
            <>
              <label className="flex items-center gap-2 font-medium">
                <Checkbox checked={paid} disabled={pending} onCheckedChange={() => setConfirming(true)} />
                Refund paid
              </label>
              {booking.refundedOn && <span className="text-xs text-muted-foreground tabular">Refunded {booking.refundedAt ? formatTimestampIST(booking.refundedAt) : formatDisplayDate(booking.refundedOn)}</span>}
            </>
          )}
          {!booking.refundedOn && (
            <Button variant="outline" size="lg" className="sm:ml-auto" disabled={pending} onClick={() => setEditing(true)}>
              <Pencil />
              Change amount
            </Button>
          )}
          {booking.refundedOn && <span className="basis-full text-xs text-muted-foreground lg:ml-auto lg:basis-auto">To reactivate this booking or change the amount, untick Refund paid first.</span>}
        </div>
      </RecordDocument>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={paid ? "Undo this refund?" : `Mark ₹${formatAmount(booking.refundAmount)} as refunded?`}
        description={paid ? "It goes back to Refund due." : "You can undo this later."}
        confirmLabel={paid ? "Undo refund" : "Mark refunded"}
        dismissLabel={paid ? "Keep it paid" : "Not yet"}
        pending={pending}
        onConfirm={setPaid}
      />

      <RecordDialog<RefundValues>
        open={editing}
        onOpenChange={setEditing}
        title="Change the refund"
        description="Up to what was received."
        schema={schema}
        defaultValues={{ refundAmount: booking.refundAmount }}
        target={{ mode: "edit", url, version: booking.updatedAt }}
        saved="Refund changed."
      >
        <NumberField name="refundAmount" label="Refund amount" required />
      </RecordDialog>
    </TitledSection>
  );
}
