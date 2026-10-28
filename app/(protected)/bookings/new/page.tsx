// app/(protected)/bookings/new/page.tsx
// New booking. The invoice number it will most likely get and today's date
// (IST) are shown read-only; the server assigns both when it is saved.

import type { Metadata } from "next";
import { BookingForm } from "@/components/bookings/booking-form/booking-form";
import { PageHeader } from "@/components/shared/page-header";
import { todayIST } from "@/lib/domain/dates";
import { newBookingDefaults } from "@/components/bookings/booking-form/defaults";
import { suggestInvoiceNumber } from "@/lib/server/bookings/service";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage() {
  const invoiceNumber = await suggestInvoiceNumber();

  return (
    <>
      <PageHeader
        back={{ href: "/bookings", label: "Bookings" }}
        eyebrow="New entry"
        title="New booking"
        description="Fill in the bill section by section — the totals on the right update as you type."
      />
      <BookingForm
        mode="create"
        defaultValues={newBookingDefaults()}
        invoice={{ number: invoiceNumber, date: todayIST(), dueDate: "" }}
      />
    </>
  );
}
