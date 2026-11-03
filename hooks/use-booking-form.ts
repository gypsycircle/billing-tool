// hooks/use-booking-form.ts
// The booking form (useRecordForm, with the API's schema plus the trip-date
// rules), and the due date shown (read-only): max(trip start − 14 days,
// invoice date), re-worked out as either changes; the server assigns the same
// value on save.

"use client";

import { useMemo } from "react";
import { useWatch } from "react-hook-form";
import { bookingDraftSchema, bookingFormSchema } from "@/lib/domain/booking.schema";
import { defaultDueDate, isValidDDMMYYYY } from "@/lib/domain/dates";
import type { BookingFormInput, BookingFormValues, InvoiceInfo } from "@/components/bookings/booking-form/defaults";
import { useRecordForm } from "./use-record-form";

export type { BookingFormInput, BookingFormValues };

const BOOKING_FIELDS = Object.keys(bookingDraftSchema.shape) as (keyof BookingFormValues)[];

export function useBookingForm(defaultValues: BookingFormInput, mode: "create" | "edit", invoice: InvoiceInfo) {
  // When editing, unchanged trip dates are accepted even if they aren't after the invoice date
  const savedTripStart = mode === "edit" ? String(defaultValues.tripStartDate ?? "") : undefined;
  const savedTripEnd = mode === "edit" ? String(defaultValues.tripEndDate ?? "") : undefined;
  const schema = useMemo(
    () =>
      bookingFormSchema({
        saved: { tripStartDate: savedTripStart, tripEndDate: savedTripEnd },
        today: mode === "create" ? invoice.date : undefined,
      }),
    [mode, invoice.date, savedTripStart, savedTripEnd]
  );
  const { form, applyServerErrors } = useRecordForm<BookingFormInput, BookingFormValues>({ schema, defaultValues, fields: BOOKING_FIELDS });
  const { control } = form;

  // ── Due date (read-only) ──────────────────────────────────────────────
  const tripStartDate = String(useWatch({ control, name: "tripStartDate" }) ?? "");
  const invoiceDate = String(useWatch({ control, name: "invoiceDate" }) ?? "");
  const dueDate =
    tripStartDate === savedTripStart || !isValidDDMMYYYY(tripStartDate)
      ? invoice.dueDate
      : defaultDueDate(tripStartDate, invoiceDate);

  return { form, dueDate, invoiceDate, tripStartDate, applyServerErrors };
}
