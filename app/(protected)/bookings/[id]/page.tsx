// app/(protected)/bookings/[id]/page.tsx
// Booking detail: the saved booking laid out like its Bill of Supply.

import { Suspense } from "react";
import type { Metadata } from "next";
import { BillProblems } from "@/components/bookings/bill-problems";
import { BookingCancellation } from "@/components/bookings/booking-cancellation";
import { BookingDetailActions } from "@/components/bookings/booking-detail-actions";
import { BookingDocument } from "@/components/bookings/booking-document";
import { BookingHistory } from "@/components/bookings/booking-history";
import { ArchivedNotice, RecordPageHeader } from "@/components/shared/record-headers";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusNotice } from "@/components/shared/status-notice";
import { isArchived } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import { actionTargetOf, type Booking } from "@/lib/domain/types";
import { getBooking, getBookingHistory } from "@/lib/server/bookings/service";
import { orNotFound } from "@/lib/server/records/load-for-page";
import { billProblems } from "@/lib/server/pdf/render";

export const metadata: Metadata = { title: "Booking" };

/**
 * Whether the booking fits the bill. Only a booking changed outside the app
 * can fail (saves are checked), so the page doesn't wait for it: the check
 * (fonts loaded once per server) streams in after the page is shown. A
 * download of a booking that doesn't fit is refused with the field to fix.
 */
async function BillCheck({ booking }: { booking: Booking }) {
  const problems = Object.values(await billProblems(booking));
  return problems.length > 0 ? <BillProblems bookingId={booking.bookingId} problems={problems} /> : null;
}

export default async function BookingDetailPage({ params }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const [booking, history] = await orNotFound(() => Promise.all([getBooking(id), getBookingHistory(id)]));
  const archived = isArchived(booking);

  return (
    <>
      <RecordPageHeader
        back={{ href: routes.bookings.list, label: "Bookings" }}
        eyebrow={`Booking No. ${booking.invoiceNumber}`}
        title={booking.customerName}
        badges={
          <>
            <StatusBadge value={booking.paymentStatus} />
            <StatusBadge value={booking.bookingStatus} />
          </>
        }
        detail={booking.packageName}
        updatedAt={booking.updatedAt}
        actions={<BookingDetailActions booking={actionTargetOf(booking)} />}
      />

      {/* Archived bookings have no bill, so there is nothing to check */}
      {!archived && (
        <Suspense fallback={null}>
          <BillCheck booking={booking} />
        </Suspense>
      )}

      {archived && <ArchivedNotice what="booking" hidden="hidden from the ledger" />}
      {booking.bookingStatus === "Cancelled" && <StatusNotice>This booking is cancelled. Only the money it keeps counts in the figures.</StatusNotice>}

      <BookingDocument booking={booking} />

      {booking.bookingStatus === "Cancelled" && <BookingCancellation booking={booking} />}

      <BookingHistory booking={booking} history={history} />
    </>
  );
}
