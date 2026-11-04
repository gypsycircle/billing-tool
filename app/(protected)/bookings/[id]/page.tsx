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
import { PageBody, PageGroup } from "@/components/shared/page-body";
import { StatusNotice } from "@/components/shared/status-notice";
import { cancelledNotice } from "@/lib/domain/bill-text";
import { pageParam } from "@/lib/domain/filters";
import { isArchived } from "@/lib/domain/records";
import { paymentBadgeOf } from "@/lib/domain/refunds";
import { routes } from "@/lib/domain/routes";
import { actionTargetOf, type Booking } from "@/lib/domain/types";
import { getBooking, getBookingHistoryPage } from "@/lib/server/bookings/service";
import { orNotFound } from "@/lib/server/records/load-for-page";
import { billOf } from "@/lib/server/pdf/content";
import { billProblems } from "@/lib/server/pdf/render";

export const metadata: Metadata = { title: "Booking" };

/**
 * Whether the booking fits the bill. Only a booking changed outside the app
 * can fail (saves are checked), so the page doesn't wait for it: the check
 * (fonts loaded once per server) streams in after the page is shown. A
 * download of a booking that doesn't fit is refused with the field to fix.
 */
async function BillCheck({ booking }: { booking: Booking }) {
  const problems = Object.values(await billProblems(billOf(booking)));
  return problems.length > 0 ? <BillProblems bookingId={booking.bookingId} problems={problems} /> : null;
}

export default async function BookingDetailPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const historyPage = pageParam.parse((await searchParams).historyPage);
  const [booking, history] = await orNotFound(() => Promise.all([getBooking(id), getBookingHistoryPage(id, historyPage)]));
  const archived = isArchived(booking);

  return (
    <>
      <RecordPageHeader
        back={{ href: routes.bookings.list, label: "Bookings" }}
        eyebrow={`Booking No. ${booking.invoiceNumber}`}
        title={booking.customerName}
        badges={
          <>
            <StatusBadge value={booking.bookingStatus} />
            <StatusBadge value={paymentBadgeOf(booking)} />
          </>
        }
        detail={booking.packageName}
        updatedAt={booking.updatedAt}
        actions={<BookingDetailActions booking={actionTargetOf(booking)} />}
      />

      <PageBody>
        <PageGroup>
          {/* Archived bookings have no bill, so there is nothing to check */}
          {!archived && (
            <Suspense fallback={null}>
              <BillCheck booking={booking} />
            </Suspense>
          )}
          {archived && <ArchivedNotice what="booking" hidden="hidden from the bookings list" />}
          {booking.bookingStatus === "Cancelled" && <StatusNotice tone="danger">{cancelledNotice(booking)}</StatusNotice>}
          <BookingDocument booking={booking} />
        </PageGroup>

        {booking.bookingStatus === "Cancelled" && <BookingCancellation booking={booking} />}

        <BookingHistory booking={booking} history={history} />
      </PageBody>
    </>
  );
}
