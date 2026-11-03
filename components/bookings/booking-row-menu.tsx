// components/bookings/booking-row-menu.tsx
// The "⋯" menu on each ledger row: the shared record menu, plus the bill
// download and cancel / reactivate.

"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RecordRowMenu } from "@/components/shared/record-menus";
import { isArchived } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import type { BookingActionTarget } from "@/lib/domain/types";
import { useBillPdf } from "@/hooks/use-bill-pdf";
import { useBookingActions } from "@/hooks/use-booking-actions";
import { BookingStatusItems, bookingArchiveCopy } from "./booking-status";
import { CancelBookingDialog } from "./cancel-booking-dialog";

export function BookingRowMenu({ booking }: { booking: BookingActionTarget }) {
  const actions = useBookingActions(booking, { inList: true });
  const bill = useBillPdf(booking);
  const archived = isArchived(booking);
  const [cancelling, setCancelling] = useState(false);

  return (
    <>
      <RecordRowMenu
        label={`booking No. ${booking.invoiceNumber}`}
        href={routes.bookings.page(booking.bookingId)}
        editHref={routes.bookings.edit(booking.bookingId)}
        archived={archived}
        actions={actions}
        copy={bookingArchiveCopy(booking)}
        openItems={
          !archived && (
            <DropdownMenuItem disabled={bill.pending} onClick={() => void bill.download()}>
              <Download />
              Download bill
            </DropdownMenuItem>
          )
        }
        statusItems={<BookingStatusItems booking={booking} actions={actions} onCancel={() => setCancelling(true)} />}
      />
      <CancelBookingDialog booking={booking} open={cancelling} onOpenChange={setCancelling} />
    </>
  );
}
