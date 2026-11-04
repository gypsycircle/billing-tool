// components/bookings/booking-status.tsx
// What a booking adds to the shared record menus (row menu and detail page):
// cancel / reactivate, and the archive confirmation's wording.

"use client";

import { Ban, RotateCcw } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { ArchiveCopy } from "@/components/shared/archive-dialog";
import type { BookingActionTarget } from "@/lib/domain/types";
import type { useBookingActions } from "@/hooks/use-booking-actions";

export const bookingArchiveCopy = (booking: Pick<BookingActionTarget, "invoiceNumber" | "customerName">): ArchiveCopy => ({
  recordLabel: "booking",
  reference: booking.invoiceNumber,
  description: `${booking.customerName}'s booking will be hidden from the list.`,
});

/** "Mark cancelled…" for an active booking (asks about the refund first), "Reactivate" for a cancelled one, unless its refund has gone back. */
export function BookingStatusItems({
  booking,
  actions,
  onCancel,
}: {
  booking: Pick<BookingActionTarget, "bookingStatus" | "refundedOn">;
  actions: ReturnType<typeof useBookingActions>;
  onCancel: () => void;
}) {
  if (booking.bookingStatus === "Active") {
    return (
      <DropdownMenuItem onClick={onCancel}>
        <Ban />
        Mark cancelled…
      </DropdownMenuItem>
    );
  }
  if (booking.bookingStatus === "Cancelled") {
    return (
      <DropdownMenuItem disabled={Boolean(booking.refundedOn)} onClick={() => void actions.reactivate()}>
        <RotateCcw />
        Reactivate
      </DropdownMenuItem>
    );
  }
  return null;
}
