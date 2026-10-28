// app/(protected)/bookings/[id]/page.tsx
// Booking detail: the saved booking laid out like its Bill of Supply.

import { Suspense } from "react";
import type { Metadata } from "next";
import { BillProblems } from "@/components/bookings/bill-problems";
import { BookingDetailActions } from "@/components/bookings/booking-detail-actions";
import { BookingDocument } from "@/components/bookings/booking-document";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatTimestampIST } from "@/lib/domain/dates";
import { actionTargetOf, type Booking } from "@/lib/domain/types";
import { loadBookingOrNotFound } from "@/lib/server/bookings/load-for-page";
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
  const booking = await loadBookingOrNotFound(id);
  const updated = formatTimestampIST(booking.updatedAt);

  return (
    <>
      <PageHeader
        back={{ href: "/bookings", label: "Bookings" }}
        eyebrow={`Booking No. ${booking.invoiceNumber}`}
        title={booking.customerName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge status={booking.paymentStatus} />
            <StatusBadge status={booking.bookingStatus} />
            <span className="text-sm">{booking.packageName}</span>
            {updated && <span className="text-xs">· Last updated {updated}</span>}
          </span>
        }
        actions={<BookingDetailActions booking={actionTargetOf(booking)} />}
      />

      {/* Archived bookings have no bill, so there is nothing to check */}
      {booking.bookingStatus !== "Archived" && (
        <Suspense fallback={null}>
          <BillCheck booking={booking} />
        </Suspense>
      )}

      {booking.bookingStatus !== "Active" && (
        <p className="mb-6 rounded-lg border bg-status-neutral-soft px-4 py-3 text-sm text-status-neutral">
          {booking.bookingStatus === "Archived"
            ? "This booking is archived: hidden from the ledger but kept, ready to restore. Restore it from More."
            : "This booking is cancelled. It is excluded from the dashboard totals."}
        </p>
      )}

      <BookingDocument booking={booking} />
    </>
  );
}
