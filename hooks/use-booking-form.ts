// hooks/use-booking-form.ts
// The booking form (useRecordForm, with the API's schema plus the trip-date
// rules), and the due date shown (read-only): max(trip start − 14 days,
// invoice date), re-worked out as either changes; the server assigns the same
// value on save.

"use client";

import { useMemo, useEffect } from "react";
import { useWatch } from "react-hook-form";
import { bookingDraftSchema, bookingFormSchema } from "@/lib/domain/booking.schema";
import { compareDDMMYYYY, defaultDueDate, isValidDDMMYYYY } from "@/lib/domain/dates";
import { ROUTE_OTHER } from "@/lib/domain/general";
import type { BookingFormInput, BookingFormValues, InvoiceInfo } from "@/components/bookings/booking-form/defaults";
import { useRecordForm } from "./use-record-form";

export type { BookingFormInput, BookingFormValues };

const BOOKING_FIELDS = Object.keys(bookingDraftSchema.shape) as (keyof BookingFormValues)[];

export function useBookingForm(defaultValues: BookingFormInput, mode: "create" | "edit", invoice: InvoiceInfo) {
  // When editing, unchanged trip dates are accepted even if they aren't after the invoice date
  const savedTripStart = mode === "edit" ? String(defaultValues.tripStartDate ?? "") : undefined;
  const savedTripEnd = mode === "edit" ? String(defaultValues.tripEndDate ?? "") : undefined;
  // ...and an unchanged note, even one saved before the note limit
  const savedNote = mode === "edit" ? String(defaultValues.invoiceNote ?? "") : undefined;
  const schema = useMemo(
    () =>
      bookingFormSchema({
        saved: { tripStartDate: savedTripStart, tripEndDate: savedTripEnd, invoiceNote: savedNote },
        today: mode === "create" ? invoice.date : undefined,
      }),
    [mode, invoice.date, savedTripStart, savedTripEnd, savedNote]
  );
  const { form, applyServerErrors } = useRecordForm<BookingFormInput, BookingFormValues>({ schema, defaultValues, fields: BOOKING_FIELDS });
  const { control } = form;

  // ── Due date (read-only) ──────────────────────────────────────────────
  const tripStartDate = String(useWatch({ control, name: "tripStartDate" }) ?? "");
  const invoiceDate = String(useWatch({ control, name: "invoiceDate" }) ?? "");
  const invoiceNote = String(useWatch({ control, name: "invoiceNote" }) ?? "");
  const packageType = String(useWatch({ control, name: "packageType" }) ?? "");

  // A private package never has a slot amount
  useEffect(() => {
    if (packageType === "Private") form.setValue("slotAmount", 0, { shouldDirty: true });
  }, [packageType, form]);

  // A date moved past a later one leaves that one impossible: it's picked again. Only the user's own changes
  useEffect(() => {
    const clear = (name: "tripStartDate" | "tripEndDate") => {
      form.setValue(name, "", { shouldDirty: true });
      form.clearErrors(name);
    };
    const isAfter = (a: string, b: string) => isValidDDMMYYYY(a) && isValidDDMMYYYY(b) && compareDDMMYYYY(a, b) > 0;
    return form.subscribe({
      name: ["invoiceDate", "tripStartDate"],
      formState: { values: true },
      callback: ({ values: { invoiceDate, tripStartDate, tripEndDate }, name, type }) => {
        if (type !== "change") return;
        // A trip is after its invoice date; its end is on or after its start
        if (name === "invoiceDate") {
          if (tripStartDate && !isAfter(tripStartDate, invoiceDate)) clear("tripStartDate");
          if (tripEndDate && !isAfter(tripEndDate, invoiceDate)) clear("tripEndDate");
        } else if (name === "tripStartDate" && isAfter(tripStartDate, tripEndDate)) {
          clear("tripEndDate");
        }
      },
    });
  }, [form]);

  // A route picked from the list replaces one typed in. Only the user's own changes
  useEffect(
    () =>
      form.subscribe({
        name: "routeDescription",
        formState: { values: true },
        callback: ({ values, type }) => {
          if (type === "change" && values.routeDescription !== ROUTE_OTHER && values.routeOther) form.setValue("routeOther", "", { shouldDirty: true });
        },
      }),
    [form]
  );

  const dueDate =
    tripStartDate === savedTripStart || !isValidDDMMYYYY(tripStartDate)
      ? invoice.dueDate
      : defaultDueDate(tripStartDate, invoiceDate);

  const routeIsTyped = useWatch({ control, name: "routeDescription" }) === ROUTE_OTHER;

  return { form, dueDate, invoiceDate, invoiceNote, packageType, routeIsTyped, tripStartDate, applyServerErrors };
}
