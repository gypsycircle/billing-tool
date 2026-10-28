// app/(protected)/bookings/[id]/page.tsx
// Booking detail: the saved booking laid out like its Bill of Supply.

import type { Metadata } from "next";
import { BillProblems } from "@/components/bookings/bill-problems";
import { BookingDetailActions } from "@/components/bookings/booking-detail-actions";
import { BookingDocument } from "@/components/bookings/booking-document";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatTimestampIST } from "@/lib/domain/dates";
import { actionTargetOf } from "@/lib/domain/types";
import { loadBookingOrNotFound } from "@/lib/server/bookings/load-for-page";
import { billProblems } from "@/lib/server/pdf/render";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingDetailPage({ params }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const booking = await loadBookingOrNotFound(id);
  const updated = formatTimestampIST(booking.updatedAt);
  // Archived bookings have no bill, so there is nothing to check
  const problems = booking.bookingStatus === "Archived" ? [] : Object.values(await billProblems(booking));

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
        actions={<BookingDetailActions booking={actionTargetOf(booking)} printable={problems.length === 0} />}
      />

      {problems.length > 0 && <BillProblems bookingId={booking.bookingId} problems={problems} />}

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
