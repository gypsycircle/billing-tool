// app/(protected)/bookings/[id]/edit/page.tsx
// Edit a booking. Archived bookings must be restored before editing.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookingForm } from "@/components/bookings/booking-form/booking-form";
import { bookingFormDefaults, invoiceInfoOf } from "@/components/bookings/booking-form/defaults";
import { PageHeader } from "@/components/shared/page-header";
import { loadBookingOrNotFound } from "@/lib/server/bookings/load-for-page";

export const metadata: Metadata = { title: "Edit booking" };

export default async function EditBookingPage({ params }: PageProps<"/bookings/[id]/edit">) {
  const { id } = await params;
  const booking = await loadBookingOrNotFound(id);
  if (booking.bookingStatus === "Archived") redirect(`/bookings/${booking.bookingId}`);

  return (
    <>
      <PageHeader
        back={{ href: `/bookings/${booking.bookingId}`, label: `Booking No. ${booking.invoiceNumber}` }}
        eyebrow={`Edit · No. ${booking.invoiceNumber}`}
        title={booking.customerName}
        description="Change what you need — totals are recalculated when you save."
      />
      <BookingForm
        mode="edit"
        bookingId={booking.bookingId}
        version={booking.updatedAt}
        defaultValues={bookingFormDefaults(booking)}
        invoice={invoiceInfoOf(booking)}
      />
    </>
  );
}
