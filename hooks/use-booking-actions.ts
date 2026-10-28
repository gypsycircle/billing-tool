// hooks/use-booking-actions.ts
// Status changes for one booking: cancel, reactivate, archive, restore.
// Each sends the version on screen (X-Booking-Version), so it can't overwrite a newer
// save; if someone else changed the booking first, the page refreshes to show it.

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BOOKING_VERSION_HEADER, type BookingRef } from "@/lib/domain/types";
import { useApiMutation } from "./use-api-mutation";

export function useBookingActions(booking: Pick<BookingRef, "bookingId" | "invoiceNumber" | "updatedAt">) {
  const router = useRouter();
  const { mutate, pending } = useApiMutation<{ booking: BookingRef }>();
  const url = `/api/bookings/${booking.bookingId}`;
  const label = `No. ${booking.invoiceNumber}`;

  const run = useCallback(
    async (request: Parameters<typeof mutate>[1], success: string, after?: () => void) => {
      const result = await mutate(url, { ...request, headers: { [BOOKING_VERSION_HEADER]: booking.updatedAt } });
      if (result?.status === 412) router.refresh(); // show the newer version
      if (!result?.data) return false;
      toast.success(success);
      after?.();
      router.refresh();
      return true;
    },
    [mutate, router, url, booking.updatedAt]
  );

  return {
    pending,
    cancel: () => run({ method: "PATCH", body: { bookingStatus: "Cancelled" } }, `Booking ${label} cancelled`),
    reactivate: () => run({ method: "PATCH", body: { bookingStatus: "Active" } }, `Booking ${label} is active again`),
    restore: () => run({ method: "PATCH", body: { bookingStatus: "Active" } }, `Booking ${label} restored`),
    /** Archive, then optionally leave the page (e.g. from the detail view). */
    archive: (afterArchive?: () => void) =>
      run({ method: "DELETE" }, `Booking ${label} archived — you can restore it from Show archived`, afterArchive),
  };
}
