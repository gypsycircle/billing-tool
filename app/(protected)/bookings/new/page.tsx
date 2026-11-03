// app/(protected)/bookings/new/page.tsx
// New booking, dated today (IST) unless yesterday is picked. The invoice number
// it will most likely get is shown read-only; the server assigns it on save.
// Destination, package and route come from the Settings lists; who closed it
// from the team.

import type { Metadata } from "next";
import { BookingForm } from "@/components/bookings/booking-form/booking-form";
import { NewRecordHeader } from "@/components/shared/record-headers";
import { routes } from "@/lib/domain/routes";
import { todayIST } from "@/lib/domain/dates";
import { newBookingDefaults } from "@/components/bookings/booking-form/defaults";
import { closedByChoices } from "@/lib/domain/types";
import { getBookingListOptions, suggestInvoiceNumbers } from "@/lib/server/bookings/service";
import { getTeamOptions } from "@/lib/server/team/service";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage() {
  const [numbers, lists, team] = await Promise.all([suggestInvoiceNumbers(), getBookingListOptions(), getTeamOptions()]);
  const today = todayIST();

  return (
    <>
      <NewRecordHeader
        back={{ href: routes.bookings.list, label: "Bookings" }}
        title="New booking"
        description="Fill in the bill section by section — the totals on the right update as you type."
      />
      <BookingForm
        mode="create"
        defaultValues={newBookingDefaults(today)}
        invoice={{ number: numbers[today], date: today, dueDate: "" }}
        numbers={numbers}
        lists={lists}
        closedBy={closedByChoices(team)}
      />
    </>
  );
}
