// components/bookings/cancel-booking-dialog.tsx
// Cancelling a booking: the refund worked out from the bill's terms, pre-filled
// and changeable (up to what was received). Unpaid bookings have nothing to refund.

"use client";

import { useMemo } from "react";
import { z } from "zod";
import { formFields } from "@/components/forms/fields";
import { RecordDialog } from "@/components/settings/record-dialog";
import { todayIST } from "@/lib/domain/dates";
import { rupees } from "@/lib/domain/field-rules";
import { formatAmount } from "@/lib/domain/money";
import { routes } from "@/lib/domain/routes";
import { refundQuote, refundWorking } from "@/lib/domain/refunds";
import type { BookingActionTarget } from "@/lib/domain/types";

type RefundValues = { refundAmount: number };
const { NumberField } = formFields<RefundValues>();

/** The refund's amount: from ₹0 up to what was received. */
export const refundFormSchema = (received: number) =>
  z.object({ refundAmount: rupees("Refund amount").max(received, `Refund cannot be more than the ₹${formatAmount(received)} received.`) });

export function CancelBookingDialog({ booking, open, onOpenChange }: { booking: BookingActionTarget; open: boolean; onOpenChange: (open: boolean) => void }) {
  const quote = refundQuote(booking, todayIST());
  const schema = useMemo(() => refundFormSchema(booking.amountPaid), [booking.amountPaid]);
  const paid = booking.amountPaid > 0;

  return (
    <RecordDialog<RefundValues>
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel booking No. ${booking.invoiceNumber}?`}
      description={paid ? refundWorking(quote, booking) : "Nothing was received, so there's nothing to refund."}
      schema={schema}
      defaultValues={{ refundAmount: quote.amount }}
      target={{ mode: "edit", url: routes.api.bookings.one(booking.bookingId), version: booking.updatedAt }}
      editBody={(values) => ({ bookingStatus: "Cancelled", refundAmount: values.refundAmount })}
      unchangedCanSave
      submitLabel="Cancel booking"
      dismissLabel="Keep booking"
      saved={`Booking No. ${booking.invoiceNumber} cancelled.`}
    >
      {paid && <NumberField name="refundAmount" label="Refund amount" hint="From the bill's terms. You can change it." required />}
    </RecordDialog>
  );
}
