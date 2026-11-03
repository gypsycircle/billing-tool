// app/(protected)/bookings/[id]/edit/page.tsx
// Edit a booking. Archived bookings must be restored before editing.

import type { Metadata } from "next";
import { BookingForm } from "@/components/bookings/booking-form/booking-form";
import { bookingFormDefaults, invoiceInfoOf } from "@/components/bookings/booking-form/defaults";
import { EditRecordHeader } from "@/components/shared/record-headers";
import { routes } from "@/lib/domain/routes";
import { closedByChoices } from "@/lib/domain/types";
import { getBooking, getBookingListOptions } from "@/lib/server/bookings/service";
import { getTeamOptions } from "@/lib/server/team/service";
import { orNotFound, redirectIfArchived } from "@/lib/server/records/load-for-page";
import { StatusNotice } from "@/components/shared/status-notice";

export const metadata: Metadata = { title: "Edit booking" };

export default async function EditBookingPage({ params }: PageProps<"/bookings/[id]/edit">) {
  const { id } = await params;
  const [booking, lists, team] = await Promise.all([orNotFound(() => getBooking(id)), getBookingListOptions(), getTeamOptions()]);
  redirectIfArchived(booking, routes.bookings.page(booking.bookingId));

  return (
    <>
      <EditRecordHeader
        back={{ href: routes.bookings.page(booking.bookingId), label: `Booking No. ${booking.invoiceNumber}` }}
        number={booking.invoiceNumber}
        title={booking.customerName}
        description="Change what you need — totals are recalculated when you save."
      />
      {booking.bookingStatus === "Cancelled" && <StatusNotice>This booking is cancelled, so its people, prices and payments can&apos;t be changed. Reactivate it first.</StatusNotice>}
      <BookingForm
        mode="edit"
        moneyLocked={booking.bookingStatus === "Cancelled"}
        bookingId={booking.bookingId}
        version={booking.updatedAt}
        defaultValues={bookingFormDefaults(booking)}
        invoice={invoiceInfoOf(booking)}
        lists={lists}
        closedBy={closedByChoices(team, booking.closedBy)}
      />
    </>
  );
}
