// hooks/use-booking-actions.ts
// A booking's status changes: archive and restore (useRecordActions), plus
// reactivate (cancelling asks about the refund first: CancelBookingDialog). `inList`: from a list row, whose archive toast says
// where to find it again (on its page, Restore is right there).

"use client";

import { routes } from "@/lib/domain/routes";
import type { BookingRef } from "@/lib/domain/types";
import { useRecordActions } from "./use-record-actions";

export function useBookingActions(booking: Pick<BookingRef, "bookingId" | "invoiceNumber" | "updatedAt">, { inList = false } = {}) {
  const title = `Booking No. ${booking.invoiceNumber}`;
  const actions = useRecordActions({
    url: routes.api.bookings.one(booking.bookingId),
    version: booking.updatedAt,
    title,
    restoreBody: { bookingStatus: "Active" },
    findArchived: inList ? "Show archived" : undefined,
  });
  return {
    ...actions,
    reactivate: () => actions.run({ method: "PATCH", body: { bookingStatus: "Active" } }, `${title} is active again`),
  };
}
