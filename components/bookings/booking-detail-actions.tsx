// components/bookings/booking-detail-actions.tsx
// Actions in the booking page's header: Edit, the Bill of Supply (preview and
// download, shortcut D), and More (cancel / reactivate / archive / restore).

"use client";

import { useState } from "react";
import { Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonKbd } from "@/components/shared/button-kbd";
import { IconAction } from "@/components/shared/icon-action";
import { RecordDetailActions } from "@/components/shared/record-menus";
import { isArchived } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import { SHORTCUTS } from "@/lib/domain/shortcuts";
import type { BookingActionTarget } from "@/lib/domain/types";
import { useBillPdf } from "@/hooks/use-bill-pdf";
import { useBookingActions } from "@/hooks/use-booking-actions";
import { useShortcut } from "@/hooks/use-shortcut";
import { BookingStatusItems, bookingArchiveCopy } from "./booking-status";
import { CancelBookingDialog } from "./cancel-booking-dialog";

export function BookingDetailActions({ booking }: { booking: BookingActionTarget }) {
  const actions = useBookingActions(booking);
  const bill = useBillPdf(booking);
  // Archived bookings have no bill. A booking that doesn't fit is refused on
  // download with the field to fix (the page also shows a warning).
  const hasBill = !isArchived(booking);
  const [cancelling, setCancelling] = useState(false);

  useShortcut(SHORTCUTS.downloadBill, () => void bill.download(), { enabled: hasBill });

  return (
    <RecordDetailActions
      editHref={routes.bookings.edit(booking.bookingId)}
      archived={!hasBill}
      actions={actions}
      copy={bookingArchiveCopy(booking)}
      statusItems={<BookingStatusItems booking={booking} actions={actions} onCancel={() => setCancelling(true)} />}
    >
      {hasBill && (
        <>
          <IconAction label="Preview the Bill of Supply in a new tab" tooltip="Preview in a new tab" variant="outline" size="icon-lg" onClick={bill.preview}>
            <Eye />
          </IconAction>

          <Button size="lg" disabled={bill.pending} onClick={() => void bill.download()}>
            {bill.pending ? <Loader2 className="animate-spin" /> : <Download />}
            Bill of Supply
            <ButtonKbd>{SHORTCUTS.downloadBill.toUpperCase()}</ButtonKbd>
          </Button>
        </>
      )}
      <CancelBookingDialog booking={booking} open={cancelling} onOpenChange={setCancelling} />
    </RecordDetailActions>
  );
}
